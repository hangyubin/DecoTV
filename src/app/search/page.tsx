/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any,@typescript-eslint/no-non-null-assertion,no-empty */
'use client';

import { ChevronUp, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, {
  startTransition,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';

import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import SearchResultFilter, {
  SearchFilterCategory,
} from '@/components/SearchResultFilter';
import SearchSuggestions from '@/components/SearchSuggestions';
import VideoCard, { VideoCardHandle } from '@/components/VideoCard';

// 搜索配置常量
const SEARCH_CONFIG = {
  RESULTS_FLUSH_DELAY: 80,
  SCROLL_THRESHOLD: 300,
  SIMILARITY_THRESHOLD: 0.7,
  MAX_CACHE_SIZE: 50,
} as const;

// 相似度计算函数 - 添加缓存优化
const calculateSimilarity = (() => {
  const cache = new Map<string, number>();
  
  return (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    
    const cacheKey = `${str1}|${str2}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      cache.set(cacheKey, 1.0);
      return 1.0;
    }
    
    let matches = 0;
    let shorterIndex = 0;
    
    for (let i = 0; i < longer.length && shorterIndex < shorter.length; i++) {
      if (longer[i] === shorter[shorterIndex]) {
        matches++;
        shorterIndex++;
      }
    }
    
    const similarity = matches / shorter.length;
    
    // 简单的缓存清理
    if (cache.size > SEARCH_CONFIG.MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(cacheKey, similarity);
    return similarity;
  };
})();

function SearchPageClient() {
  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  // 返回顶部按钮显示状态
  const [showBackToTop, setShowBackToTop] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQueryRef = useRef<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [totalSources, setTotalSources] = useState(0);
  const [completedSources, setCompletedSources] = useState(0);
  const pendingResultsRef = useRef<SearchResult[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const [useFluidSearch, setUseFluidSearch] = useState(true);
  
  // 过滤器状态 - 移到前面声明
  const [filterAll, setFilterAll] = useState({
    source: 'all',
    title: 'all',
    year: 'all',
    yearOrder: 'none' as const,
  });

  const [filterAgg, setFilterAgg] = useState({
    source: 'all',
    title: 'all',
    year: 'all',
    yearOrder: 'none' as const,
  });

  // 获取默认聚合设置
  const getDefaultAggregate = useCallback(() => {
    if (typeof window !== 'undefined') {
      const userSetting = localStorage.getItem('defaultAggregateSearch');
      if (userSetting !== null) {
        return JSON.parse(userSetting);
      }
    }
    return true;
  }, []);

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(() => {
    return getDefaultAggregate() ? 'agg' : 'all';
  });
  
  // 聚合卡片 refs 与聚合统计缓存
  const groupRefs = useRef<Map<string, React.RefObject<VideoCardHandle>>>(
    new Map()
  );
  const groupStatsRef = useRef<
    Map<
      string,
      { douban_id?: number; episodes?: number; source_names: string[] }
    >
  >(new Map());

  // 聚合结果缓存
  const aggregationCacheRef = useRef<{
    key: string;
    results: [string, SearchResult[]][];
  }>({ key: '', results: [] });

  // 使用 useCallback 优化函数
  const getGroupRef = useCallback((key: string) => {
    let ref = groupRefs.current.get(key);
    if (!ref) {
      ref = React.createRef<VideoCardHandle>();
      groupRefs.current.set(key, ref);
    }
    return ref;
  }, []);

  const computeGroupStats = useCallback((group: SearchResult[]) => {
    const episodes = (() => {
      const countMap = new Map<number, number>();
      group.forEach((g) => {
        const len = g.episodes?.length || 0;
        if (len > 0) countMap.set(len, (countMap.get(len) || 0) + 1);
      });
      let max = 0;
      let res = 0;
      countMap.forEach((v, k) => {
        if (v > max) {
          max = v;
          res = k;
        }
      });
      return res;
    })();
    
    const source_names = Array.from(
      new Set(group.map((g) => g.source_name).filter(Boolean))
    ) as string[];

    const douban_id = (() => {
      const countMap = new Map<number, number>();
      group.forEach((g) => {
        if (g.douban_id && g.douban_id > 0) {
          countMap.set(g.douban_id, (countMap.get(g.douban_id) || 0) + 1);
        }
      });
      let max = 0;
      let res: number | undefined;
      countMap.forEach((v, k) => {
        if (v > max) {
          max = v;
          res = k;
        }
      });
      return res;
    })();

    return { episodes, source_names, douban_id };
  }, []);

  // 使用 useCallback 优化事件处理函数
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim()) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, []);

  const handleInputFocus = useCallback(() => {
    if (searchQuery.trim()) {
      setShowSuggestions(true);
    }
  }, [searchQuery]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);
    setShowSuggestions(false);

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [searchQuery, router]);

  const handleEnterKey = useCallback(() => {
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);
    setShowSuggestions(false);

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [searchQuery, router]);

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    setIsLoading(true);
    setShowResults(true);
    router.push(`/search?q=${encodeURIComponent(suggestion)}`);
  }, [router]);

  // 优化滚动处理函数
  const handleScroll = useCallback(() => {
    const scrollTop = document.body.scrollTop || 0;
    setShowBackToTop(scrollTop > SEARCH_CONFIG.SCROLL_THRESHOLD);
  }, []);

  // 返回顶部功能
  const scrollToTop = useCallback(() => {
    try {
      document.body.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (error) {
      document.body.scrollTop = 0;
    }
  }, []);

  // 优化结果刷新逻辑
  const flushPendingResults = useCallback(() => {
    if (pendingResultsRef.current.length > 0) {
      const toAppend = pendingResultsRef.current;
      pendingResultsRef.current = [];
      startTransition(() => {
        setSearchResults((prev) => prev.concat(toAppend));
      });
    }
  }, []);

  // 简化的年份排序函数
  const compareYear = useCallback((
    aYear: string,
    bYear: string,
    order: 'none' | 'asc' | 'desc'
  ) => {
    if (order === 'none') return 0;

    const aIsEmpty = !aYear || aYear === 'unknown';
    const bIsEmpty = !bYear || bYear === 'unknown';

    if (aIsEmpty && bIsEmpty) return 0;
    if (aIsEmpty) return 1;
    if (bIsEmpty) return -1;

    const aNum = parseInt(aYear, 10);
    const bNum = parseInt(bYear, 10);

    return order === 'asc' ? aNum - bNum : bNum - aNum;
  }, []);

  // 改进的聚合结果计算 - 添加缓存优化
  const aggregatedResults = useMemo(() => {
    const query = currentQueryRef.current.trim().toLowerCase();
    
    if (!query) return [];

    // 检查缓存
    const cacheKey = `${query}-${searchResults.length}-${searchResults
      .slice(0, 3)
      .map(r => r.id)
      .join('-')}`;
    
    if (aggregationCacheRef.current.key === cacheKey) {
      return aggregationCacheRef.current.results;
    }

    const relevantResults = searchResults.filter((item) => {
      const title = item.title.toLowerCase();
      
      if (query.length <= 2) {
        return (
          title.includes(query) ||
          title.replace(/\s+/g, '').includes(query.replace(/\s+/g, ''))
        );
      }

      const matchStrategies = [
        title === query,
        title.includes(query),
        title.replace(/[^\w\u4e00-\u9fa5]/g, '').includes(query.replace(/[^\w\u4e00-\u9fa5]/g, '')),
        title.startsWith(query),
        title.endsWith(query),
        ...(query.length > 1 ? [
          query.split('').every(char => title.includes(char)),
        ] : []),
        ...(query.length > 2 ? [
          calculateSimilarity(title, query) > SEARCH_CONFIG.SIMILARITY_THRESHOLD,
        ] : []),
      ];

      return matchStrategies.some(match => match);
    });

    const map = new Map<string, SearchResult[]>();
    const keyOrder: string[] = [];

    relevantResults.forEach((item) => {
      const normalizedTitle = item.title.trim().toLowerCase().replace(/\s+/g, '');
      const year = item.year || 'unknown';
      const type = item.episodes.length === 1 ? 'movie' : 'tv';
      const key = `${normalizedTitle}-${year}-${type}`;
      
      const arr = map.get(key) || [];

      if (arr.length === 0) {
        keyOrder.push(key);
      }

      arr.push(item);
      map.set(key, arr);
    });

    const results = keyOrder.map(
      (key) => [key, map.get(key)!] as [string, SearchResult[]]
    );

    // 更新缓存
    aggregationCacheRef.current = { key: cacheKey, results };
    return results;
  }, [searchResults]);

  // 当聚合结果变化时，如果某个聚合已存在，则调用其卡片 ref 的 set 方法增量更新
  useEffect(() => {
    aggregatedResults.forEach(([mapKey, group]) => {
      const stats = computeGroupStats(group);
      const prev = groupStatsRef.current.get(mapKey);
      if (!prev) {
        groupStatsRef.current.set(mapKey, stats);
        return;
      }
      
      const ref = groupRefs.current.get(mapKey);
      if (ref && ref.current) {
        if (prev.episodes !== stats.episodes) {
          ref.current.setEpisodes(stats.episodes);
        }
        const prevNames = (prev.source_names || []).join('|');
        const nextNames = (stats.source_names || []).join('|');
        if (prevNames !== nextNames) {
          ref.current.setSourceNames(stats.source_names);
        }
        if (prev.douban_id !== stats.douban_id) {
          ref.current.setDoubanId(stats.douban_id);
        }
        groupStatsRef.current.set(mapKey, stats);
      }
    });
  }, [aggregatedResults, computeGroupStats]);

  // 构建筛选选项 - 添加缓存优化
  const filterOptions = useMemo(() => {
    const cacheKey = searchResults.map(r => `${r.source}-${r.title}-${r.year}`).join('|');
    const cached = sessionStorage.getItem(`filterOptions-${cacheKey}`);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const sourcesSet = new Map<string, string>();
    const titlesSet = new Set<string>();
    const yearsSet = new Set<string>();

    searchResults.forEach((item) => {
      if (item.source && item.source_name) {
        sourcesSet.set(item.source, item.source_name);
      }
      if (item.title) titlesSet.add(item.title);
      if (item.year) yearsSet.add(item.year);
    });

    const sourceOptions = [
      { label: '全部来源', value: 'all' },
      ...Array.from(sourcesSet.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ label, value })),
    ];

    const titleOptions = [
      { label: '全部标题', value: 'all' },
      ...Array.from(titlesSet.values())
        .sort((a, b) => a.localeCompare(b))
        .map((t) => ({ label: t, value: t })),
    ];

    const years = Array.from(yearsSet.values());
    const knownYears = years
      .filter((y) => y !== 'unknown')
      .sort((a, b) => parseInt(b) - parseInt(a));
    const hasUnknown = years.includes('unknown');
    const yearOptions = [
      { label: '全部年份', value: 'all' },
      ...knownYears.map((y) => ({ label: y, value: y })),
      ...(hasUnknown ? [{ label: '未知', value: 'unknown' }] : []),
    ];

    const categoriesAll: SearchFilterCategory[] = [
      { key: 'source', label: '来源', options: sourceOptions },
      { key: 'title', label: '标题', options: titleOptions },
      { key: 'year', label: '年份', options: yearOptions },
    ];

    const categoriesAgg: SearchFilterCategory[] = [
      { key: 'source', label: '来源', options: sourceOptions },
      { key: 'title', label: '标题', options: titleOptions },
      { key: 'year', label: '年份', options: yearOptions },
    ];

    const result = { categoriesAll, categoriesAgg };
    
    // 缓存结果
    if (searchResults.length > 0) {
      sessionStorage.setItem(`filterOptions-${cacheKey}`, JSON.stringify(result));
    }
    
    return result;
  }, [searchResults]);

  // 非聚合：应用筛选与排序
  const filteredAllResults = useMemo(() => {
    const { source, title, year, yearOrder } = filterAll;
    const filtered = searchResults.filter((item) => {
      if (source !== 'all' && item.source !== source) return false;
      if (title !== 'all' && item.title !== title) return false;
      if (year !== 'all' && item.year !== year) return false;
      return true;
    });

    if (yearOrder === 'none') {
      return filtered;
    }

    return filtered.sort((a, b) => {
      const yearComp = compareYear(a.year, b.year, yearOrder);
      if (yearComp !== 0) return yearComp;

      const aExactMatch = a.title === searchQuery.trim();
      const bExactMatch = b.title === searchQuery.trim();
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      return yearOrder === 'asc'
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    });
  }, [searchResults, filterAll, searchQuery, compareYear]);

  // 聚合：应用筛选与排序
  const filteredAggResults = useMemo(() => {
    const { source, title, year, yearOrder } = filterAgg as any;
    const filtered = aggregatedResults.filter(([_, group]) => {
      const gTitle = group[0]?.title ?? '';
      const gYear = group[0]?.year ?? 'unknown';
      const hasSource =
        source === 'all' ? true : group.some((item) => item.source === source);
      if (!hasSource) return false;
      if (title !== 'all' && gTitle !== title) return false;
      if (year !== 'all' && gYear !== year) return false;
      return true;
    });

    if (yearOrder === 'none') {
      return filtered;
    }

    return filtered.sort((a, b) => {
      const aYear = a[1][0].year;
      const bYear = b[1][0].year;
      const yearComp = compareYear(aYear, bYear, yearOrder);
      if (yearComp !== 0) return yearComp;

      const aExactMatch = a[1][0].title === searchQuery.trim();
      const bExactMatch = b[1][0].title === searchQuery.trim();
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      const aTitle = a[1][0].title;
      const bTitle = b[1][0].title;
      return yearOrder === 'asc'
        ? aTitle.localeCompare(bTitle)
        : bTitle.localeCompare(aTitle);
    });
  }, [aggregatedResults, filterAgg, searchQuery, compareYear]);

  // 主 useEffect - 优化资源管理
  useEffect(() => {
    let isMounted = true;

    // 无搜索参数时聚焦搜索框
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 初始加载搜索历史
    getSearchHistory().then((history) => {
      if (isMounted) setSearchHistory(history);
    });

    // 读取流式搜索设置
    if (typeof window !== 'undefined') {
      const savedFluidSearch = localStorage.getItem('fluidSearch');
      const defaultFluidSearch =
        (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
      if (savedFluidSearch !== null) {
        setUseFluidSearch(JSON.parse(savedFluidSearch));
      } else if (defaultFluidSearch !== undefined) {
        setUseFluidSearch(defaultFluidSearch);
      }
    }

    // 监听搜索历史更新事件
    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        if (isMounted) setSearchHistory(newHistory);
      }
    );

    // 监听滚动事件
    document.body.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      isMounted = false;
      unsubscribe();
      document.body.removeEventListener('scroll', handleScroll);
      
      // 清理所有资源
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      pendingResultsRef.current = [];
    };
  }, [searchParams, handleScroll]);

  // 搜索参数变化处理 - 优化资源管理
  useEffect(() => {
    let isActive = true;

    const query = searchParams.get('q') || '';
    currentQueryRef.current = query.trim();

    if (query) {
      setSearchQuery(query);
      
      // 清理旧连接
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      
      setSearchResults([]);
      setTotalSources(0);
      setCompletedSources(0);
      pendingResultsRef.current = [];
      
      setIsLoading(true);
      setShowResults(true);

      const trimmed = query.trim();

      // 读取最新设置
      let currentFluidSearch = useFluidSearch;
      if (typeof window !== 'undefined') {
        const savedFluidSearch = localStorage.getItem('fluidSearch');
        if (savedFluidSearch !== null) {
          currentFluidSearch = JSON.parse(savedFluidSearch);
        } else {
          const defaultFluidSearch =
            (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
          currentFluidSearch = defaultFluidSearch;
        }
      }

      if (currentFluidSearch !== useFluidSearch) {
        setUseFluidSearch(currentFluidSearch);
      }

      if (currentFluidSearch) {
        // 流式搜索
        const es = new EventSource(
          `/api/search/ws?q=${encodeURIComponent(trimmed)}`
        );
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (!event.data || !isActive || currentQueryRef.current !== trimmed) return;
          
          try {
            const payload = JSON.parse(event.data);
            
            switch (payload.type) {
              case 'start':
                setTotalSources(payload.totalSources || 0);
                setCompletedSources(0);
                break;
              case 'source_result':
                setCompletedSources((prev) => prev + 1);
                if (payload.results?.length) {
                  pendingResultsRef.current.push(...payload.results);
                  if (!flushTimerRef.current) {
                    flushTimerRef.current = window.setTimeout(() => {
                      flushPendingResults();
                      flushTimerRef.current = null;
                    }, SEARCH_CONFIG.RESULTS_FLUSH_DELAY);
                  }
                }
                break;
              case 'source_error':
                setCompletedSources((prev) => prev + 1);
                break;
              case 'complete':
                setCompletedSources(payload.completedSources || totalSources);
                flushPendingResults();
                setIsLoading(false);
                es.close();
                if (eventSourceRef.current === es) {
                  eventSourceRef.current = null;
                }
                break;
            }
          } catch (error) {
            console.error('Parse search event error:', error);
          }
        };

        es.onerror = () => {
          if (isActive) {
            setIsLoading(false);
            flushPendingResults();
            es.close();
            if (eventSourceRef.current === es) {
              eventSourceRef.current = null;
            }
          }
        };
      } else {
        // 传统搜索
        fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
          .then((response) => response.json())
          .then((data) => {
            if (!isActive || currentQueryRef.current !== trimmed) return;

            if (data.results && Array.isArray(data.results)) {
              setSearchResults(data.results as SearchResult[]);
              setTotalSources(1);
              setCompletedSources(1);
            }
            setIsLoading(false);
          })
          .catch(() => {
            if (isActive) setIsLoading(false);
          });
      }
      
      setShowSuggestions(false);
      addSearchHistory(query);
    } else {
      setShowResults(false);
      setShowSuggestions(false);
    }

    return () => {
      isActive = false;
    };
  }, [searchParams, useFluidSearch, flushPendingResults, totalSources]);

  // 渲染优化的加载状态组件
  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      {useFluidSearch && totalSources > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          正在搜索... ({completedSources}/{totalSources})
        </div>
      )}
    </div>
  );

  // 渲染空状态组件
  const renderEmptyState = () => (
    <div className="text-center text-gray-500 py-8 dark:text-gray-400">
      未找到相关结果
    </div>
  );

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        {/* 搜索框 */}
        <div className='mb-8'>
          <form onSubmit={handleSearch} className='max-w-2xl mx-auto'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
              <input
                id='searchInput'
                type='text'
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                placeholder='搜索电影、电视剧...'
                autoComplete='off'
                className='w-full h-12 rounded-lg bg-gray-50/80 py-3 pl-10 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700'
              />

              {/* 清除按钮 */}
              {searchQuery && (
                <button
                  type='button'
                  onClick={() => {
                    setSearchQuery('');
                    setShowSuggestions(false);
                    document.getElementById('searchInput')?.focus();
                  }}
                  className='absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300'
                  aria-label='清除搜索内容'
                >
                  <X className='h-5 w-5' />
                </button>
              )}

              {/* 搜索建议 */}
              <SearchSuggestions
                query={searchQuery}
                isVisible={showSuggestions}
                onSelect={handleSuggestionSelect}
                onClose={() => setShowSuggestions(false)}
                onEnterKey={handleEnterKey}
              />
            </div>
          </form>
        </div>

        {/* 搜索结果或搜索历史 */}
        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {showResults ? (
            <section className='mb-12'>
              {/* 标题 */}
              <div className='mb-4'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                  搜索结果
                  {totalSources > 0 && useFluidSearch && (
                    <span className='ml-2 text-sm font-normal text-gray-500 dark:text-gray-400'>
                      {completedSources}/{totalSources}
                    </span>
                  )}
                  {isLoading && useFluidSearch && (
                    <span className='ml-2 inline-block align-middle'>
                      <span className='inline-block h-3 w-3 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin'></span>
                    </span>
                  )}
                </h2>
              </div>
              
              {/* 筛选器 + 聚合开关 */}
              <div className='mb-8 flex items-center justify-between gap-3'>
                <div className='flex-1 min-w-0'>
                  {viewMode === 'agg' ? (
                    <SearchResultFilter
                      categories={filterOptions.categoriesAgg}
                      values={filterAgg}
                      onChange={(v) => setFilterAgg(v as any)}
                    />
                  ) : (
                    <SearchResultFilter
                      categories={filterOptions.categoriesAll}
                      values={filterAll}
                      onChange={(v) => setFilterAll(v as any)}
                    />
                  )}
                </div>
                
                {/* 聚合开关 */}
                <label className='flex items-center gap-2 cursor-pointer select-none shrink-0'>
                  <span className='text-xs sm:text-sm text-gray-700 dark:text-gray-300'>
                    聚合
                  </span>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={viewMode === 'agg'}
                      onChange={() =>
                        setViewMode(viewMode === 'agg' ? 'all' : 'agg')
                      }
                    />
                    <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                  </div>
                </label>
              </div>

              {/* 搜索结果列表 */}
              {searchResults.length === 0 ? (
                isLoading ? (
                  renderLoadingState()
                ) : (
                  renderEmptyState()
                )
              ) : (
                <div
                  key={`search-results-${viewMode}`}
                  className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'
                >
                  {viewMode === 'agg'
                    ? filteredAggResults.map(([mapKey, group]) => {
                        const title = group[0]?.title || '';
                        const poster = group[0]?.poster || '';
                        const year = group[0]?.year || 'unknown';
                        const { episodes, source_names, douban_id } =
                          computeGroupStats(group);
                        const type = episodes === 1 ? 'movie' : 'tv';

                        if (!groupStatsRef.current.has(mapKey)) {
                          groupStatsRef.current.set(mapKey, {
                            episodes,
                            source_names,
                            douban_id,
                          });
                        }

                        return (
                          <div key={`agg-${mapKey}`} className='w-full'>
                            <VideoCard
                              ref={getGroupRef(mapKey)}
                              from='search'
                              isAggregate={true}
                              title={title}
                              poster={poster}
                              year={year}
                              episodes={episodes}
                              source_names={source_names}
                              douban_id={douban_id}
                              query={
                                searchQuery.trim() !== title
                                  ? searchQuery.trim()
                                  : ''
                              }
                              type={type}
                            />
                          </div>
                        );
                      })
                    : filteredAllResults.map((item) => (
                        <div
                          key={`all-${item.source}-${item.id}`}
                          className='w-full'
                        >
                          <VideoCard
                            id={item.id}
                            title={item.title}
                            poster={item.poster}
                            episodes={item.episodes.length}
                            source={item.source}
                            source_name={item.source_name}
                            douban_id={item.douban_id}
                            query={
                              searchQuery.trim() !== item.title
                                ? searchQuery.trim()
                                : ''
                            }
                            year={item.year}
                            from='search'
                            type={item.episodes.length > 1 ? 'tv' : 'movie'}
                          />
                        </div>
                      ))}
                </div>
              )}
            </section>
          ) : searchHistory.length > 0 ? (
            // 搜索历史
            <section className='mb-12'>
              <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                搜索历史
                {searchHistory.length > 0 && (
                  <button
                    onClick={() => {
                      clearSearchHistory();
                    }}
                    className='ml-3 text-sm text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400 dark:hover:text-red-500'
                  >
                    清空
                  </button>
                )}
              </h2>
              <div className='flex flex-wrap gap-2'>
                {searchHistory.map((item) => (
                  <div key={item} className='relative group'>
                    <button
                      onClick={() => {
                        setSearchQuery(item);
                        router.push(
                          `/search?q=${encodeURIComponent(item.trim())}`
                        );
                      }}
                      className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
                    >
                      {item}
                    </button>
                    {/* 删除按钮 */}
                    <button
                      aria-label='删除搜索历史'
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        deleteSearchHistory(item);
                      }}
                      className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* 返回顶部悬浮按钮 */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 md:bottom-6 right-6 z-[500] w-12 h-12 bg-green-500/90 hover:bg-green-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label='返回顶部'
      >
        <ChevronUp className='w-6 h-6 transition-transform group-hover:scale-110' />
      </button>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
