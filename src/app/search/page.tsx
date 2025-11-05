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

// 配置常量
const SEARCH_CONFIG = {
  FLUSH_DELAY: 80,
  BACK_TO_TOP_THRESHOLD: 300,
  DEFAULT_AGGREGATE: true,
} as const;

// 类型定义
interface SearchFilter {
  source: string;
  title: string;
  year: string;
  yearOrder: 'none' | 'asc' | 'desc';
}

interface GroupStats {
  douban_id?: number;
  episodes?: number;
  source_names: string[];
}

// 自定义 Hook：搜索历史
function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    getSearchHistory().then(setSearchHistory);
    
    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        setSearchHistory(newHistory);
      }
    );

    return unsubscribe;
  }, []);

  return {
    searchHistory,
    addHistory: addSearchHistory,
    deleteHistory: deleteSearchHistory,
    clearHistory: clearSearchHistory,
  };
}

// 自定义 Hook：滚动到顶部
function useScrollToTop(threshold = SEARCH_CONFIG.BACK_TO_TOP_THRESHOLD) {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const getScrollTop = () => document.body.scrollTop || 0;
    const handleScroll = () => setShowBackToTop(getScrollTop() > threshold);

    document.body.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 初始检查

    return () => document.body.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    try {
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      document.body.scrollTop = 0;
    }
  };

  return { showBackToTop, scrollToTop };
}

// 子组件：聚合开关
function AggregateToggle({ 
  viewMode, 
  setViewMode 
}: { 
  viewMode: 'agg' | 'all'; 
  setViewMode: (mode: 'agg' | 'all') => void;
}) {
  return (
    <label className='flex items-center gap-2 cursor-pointer select-none shrink-0'>
      <span className='text-xs sm:text-sm text-gray-700 dark:text-gray-300'>聚合</span>
      <div className='relative'>
        <input
          type='checkbox'
          className='sr-only peer'
          checked={viewMode === 'agg'}
          onChange={() => setViewMode(viewMode === 'agg' ? 'all' : 'agg')}
        />
        <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
        <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
      </div>
    </label>
  );
}

// 子组件：搜索结果网格
function ResultsGrid({ 
  viewMode, 
  filteredAllResults, 
  filteredAggResults, 
  searchQuery, 
  getGroupRef, 
  computeGroupStats 
}: {
  viewMode: 'agg' | 'all';
  filteredAllResults: SearchResult[];
  filteredAggResults: [string, SearchResult[]][];
  searchQuery: string;
  getGroupRef: (key: string) => React.RefObject<VideoCardHandle>;
  computeGroupStats: (group: SearchResult[]) => GroupStats;
}) {
  return (
    <div
      key={`search-results-${viewMode}`}
      className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'
    >
      {viewMode === 'agg'
        ? filteredAggResults.map(([mapKey, group]) => {
            const title = group[0]?.title || '';
            const poster = group[0]?.poster || '';
            const year = group[0]?.year || 'unknown';
            const { episodes, source_names, douban_id } = computeGroupStats(group);
            const type = episodes === 1 ? 'movie' : 'tv';

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
                  query={searchQuery.trim() !== title ? searchQuery.trim() : ''}
                  type={type}
                />
              </div>
            );
          })
        : filteredAllResults.map((item) => (
            <div key={`all-${item.source}-${item.id}`} className='w-full'>
              <VideoCard
                id={item.id}
                title={item.title}
                poster={item.poster}
                episodes={item.episodes.length}
                source={item.source}
                source_name={item.source_name}
                douban_id={item.douban_id}
                query={searchQuery.trim() !== item.title ? searchQuery.trim() : ''}
                year={item.year}
                from='search'
                type={item.episodes.length > 1 ? 'tv' : 'movie'}
              />
            </div>
          ))}
    </div>
  );
}

// 子组件：搜索历史区域
function SearchHistorySection({ 
  searchHistory, 
  onSearch, 
  onDelete, 
  onClear 
}: {
  searchHistory: string[];
  onSearch: (query: string) => void;
  onDelete: (query: string) => void;
  onClear: () => void;
}) {
  return (
    <section className='mb-12'>
      <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
        搜索历史
        {searchHistory.length > 0 && (
          <button
            onClick={onClear}
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
              onClick={() => onSearch(item)}
              className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
            >
              {item}
            </button>
            <button
              aria-label='删除搜索历史'
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
            >
              <X className='w-3 h-3' />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// 子组件：返回顶部按钮
function BackToTopButton({ 
  show, 
  onClick 
}: { 
  show: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-20 md:bottom-6 right-6 z-[500] w-12 h-12 bg-green-500/90 hover:bg-green-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
        show
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-label='返回顶部'
    >
      <ChevronUp className='w-6 h-6 transition-transform group-hover:scale-110' />
    </button>
  );
}

function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 使用自定义 Hooks
  const { searchHistory, addHistory, deleteHistory, clearHistory } = useSearchHistory();
  const { showBackToTop, scrollToTop } = useScrollToTop();

  // 搜索状态
  const currentQueryRef = useRef<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [useFluidSearch, setUseFluidSearch] = useState(true);

  // 流式搜索相关
  const eventSourceRef = useRef<EventSource | null>(null);
  const [totalSources, setTotalSources] = useState(0);
  const [completedSources, setCompletedSources] = useState(0);
  const pendingResultsRef = useRef<SearchResult[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  // 聚合相关
  const groupRefs = useRef<Map<string, React.RefObject<VideoCardHandle>>>(new Map());
  const groupStatsRef = useRef<Map<string, GroupStats>>(new Map());

  // 视图模式和过滤器
  const [viewMode, setViewMode] = useState<'agg' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const userSetting = localStorage.getItem('defaultAggregateSearch');
      return userSetting !== null ? JSON.parse(userSetting) ? 'agg' : 'all' : 'agg';
    }
    return 'agg';
  });

  const [filterAll, setFilterAll] = useState<SearchFilter>({
    source: 'all',
    title: 'all',
    year: 'all',
    yearOrder: 'none',
  });

  const [filterAgg, setFilterAgg] = useState<SearchFilter>({
    source: 'all',
    title: 'all',
    year: 'all',
    yearOrder: 'none',
  });

  // 工具函数
  const getGroupRef = (key: string) => {
    let ref = groupRefs.current.get(key);
    if (!ref) {
      ref = React.createRef<VideoCardHandle>();
      groupRefs.current.set(key, ref);
    }
    return ref;
  };

  const computeGroupStats = (group: SearchResult[]): GroupStats => {
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
  };

  const compareYear = (
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
  };

  // 聚合结果计算
  const aggregatedResults = useMemo(() => {
    const query = currentQueryRef.current.trim().toLowerCase();
    const queryNoSpace = query.replace(/\s+/g, '');

    const relevantResults = searchResults.filter((item) => {
      const title = item.title.toLowerCase();
      const titleNoSpace = title.replace(/\s+/g, '');

      if (title.includes(query) || titleNoSpace.includes(queryNoSpace)) {
        return true;
      }

      let queryIndex = 0;
      for (let i = 0; i < titleNoSpace.length && queryIndex < queryNoSpace.length; i++) {
        if (titleNoSpace[i] === queryNoSpace[queryIndex]) {
          queryIndex++;
        }
      }
      return queryIndex === queryNoSpace.length;
    });

    const map = new Map<string, SearchResult[]>();
    const keyOrder: string[] = [];

    relevantResults.forEach((item) => {
      const key = `${item.title.replaceAll(' ', '')}-${item.year || 'unknown'}-${item.episodes.length === 1 ? 'movie' : 'tv'}`;
      const arr = map.get(key) || [];

      if (arr.length === 0) {
        keyOrder.push(key);
      }

      arr.push(item);
      map.set(key, arr);
    });

    return keyOrder.map((key) => [key, map.get(key)!] as [string, SearchResult[]]);
  }, [searchResults]);

  // 筛选选项计算
  const filterOptions = useMemo(() => {
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

    return { categoriesAll, categoriesAgg };
  }, [searchResults]);

  // 筛选结果计算
  const filteredAllResults = useMemo(() => {
    const { source, title, year, yearOrder } = filterAll;
    const filtered = searchResults.filter((item) => {
      if (source !== 'all' && item.source !== source) return false;
      if (title !== 'all' && item.title !== title) return false;
      if (year !== 'all' && item.year !== year) return false;
      return true;
    });

    if (yearOrder === 'none') return filtered;

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
  }, [searchResults, filterAll, searchQuery]);

  const filteredAggResults = useMemo(() => {
    const { source, title, year, yearOrder } = filterAgg;
    const filtered = aggregatedResults.filter(([_, group]) => {
      const gTitle = group[0]?.title ?? '';
      const gYear = group[0]?.year ?? 'unknown';
      const hasSource = source === 'all' ? true : group.some((item) => item.source === source);
      if (!hasSource) return false;
      if (title !== 'all' && gTitle !== title) return false;
      if (year !== 'all' && gYear !== year) return false;
      return true;
    });

    if (yearOrder === 'none') return filtered;

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
  }, [aggregatedResults, filterAgg, searchQuery]);

  // 聚合统计更新
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
  }, [aggregatedResults]);

  // 初始化
  useEffect(() => {
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 读取流式搜索设置
    if (typeof window !== 'undefined') {
      const savedFluidSearch = localStorage.getItem('fluidSearch');
      const defaultFluidSearch = (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
      if (savedFluidSearch !== null) {
        setUseFluidSearch(JSON.parse(savedFluidSearch));
      } else if (defaultFluidSearch !== undefined) {
        setUseFluidSearch(defaultFluidSearch);
      }
    }
  }, []);

  // 搜索参数变化处理
  useEffect(() => {
    const query = searchParams.get('q') || '';
    currentQueryRef.current = query.trim();

    if (query) {
      setSearchQuery(query);
      
      // 清理旧搜索
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      setSearchResults([]);
      setTotalSources(0);
      setCompletedSources(0);
      pendingResultsRef.current = [];
      
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      
      setIsLoading(true);
      setShowResults(true);

      const trimmed = query.trim();

      // 更新流式搜索设置
      let currentFluidSearch = useFluidSearch;
      if (typeof window !== 'undefined') {
        const savedFluidSearch = localStorage.getItem('fluidSearch');
        if (savedFluidSearch !== null) {
          currentFluidSearch = JSON.parse(savedFluidSearch);
        } else {
          const defaultFluidSearch = (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
          currentFluidSearch = defaultFluidSearch;
        }
      }

      if (currentFluidSearch !== useFluidSearch) {
        setUseFluidSearch(currentFluidSearch);
      }

      const flushPendingResults = () => {
        if (pendingResultsRef.current.length > 0) {
          const toAppend = pendingResultsRef.current;
          pendingResultsRef.current = [];
          startTransition(() => {
            setSearchResults((prev) => prev.concat(toAppend));
          });
        }
      };

      if (currentFluidSearch) {
        // 流式搜索
        const es = new EventSource(`/api/search/ws?q=${encodeURIComponent(trimmed)}`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (!event.data) return;
          try {
            const payload = JSON.parse(event.data);
            if (currentQueryRef.current !== trimmed) return;
            
            switch (payload.type) {
              case 'start':
                setTotalSources(payload.totalSources || 0);
                setCompletedSources(0);
                break;
              case 'source_result':
                setCompletedSources((prev) => prev + 1);
                if (Array.isArray(payload.results) && payload.results.length > 0) {
                  pendingResultsRef.current.push(...payload.results as SearchResult[]);
                  if (!flushTimerRef.current) {
                    flushTimerRef.current = window.setTimeout(() => {
                      flushPendingResults();
                      flushTimerRef.current = null;
                    }, SEARCH_CONFIG.FLUSH_DELAY);
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
          } catch {}
        };

        es.onerror = () => {
          setIsLoading(false);
          flushPendingResults();
          es.close();
          if (eventSourceRef.current === es) {
            eventSourceRef.current = null;
          }
        };
      } else {
        // 传统搜索
        fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
          .then((response) => response.json())
          .then((data) => {
            if (currentQueryRef.current !== trimmed) return;

            if (data.results && Array.isArray(data.results)) {
              setSearchResults(data.results as SearchResult[]);
              setTotalSources(1);
              setCompletedSources(1);
            }
            setIsLoading(false);
          })
          .catch(() => {
            setIsLoading(false);
          });
      }
      
      setShowSuggestions(false);
      addHistory(query);
    } else {
      setShowResults(false);
      setShowSuggestions(false);
    }
  }, [searchParams]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  // 事件处理函数
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(!!value.trim());
  };

  const handleInputFocus = () => {
    if (searchQuery.trim()) {
      setShowSuggestions(true);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);
    setShowSuggestions(false);

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    setIsLoading(true);
    setShowResults(true);
    router.push(`/search?q=${encodeURIComponent(suggestion)}`);
  };

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

              <SearchSuggestions
                query={searchQuery}
                isVisible={showSuggestions}
                onSelect={handleSuggestionSelect}
                onClose={() => setShowSuggestions(false)}
                onEnterKey={handleSearch}
              />
            </div>
          </form>
        </div>

        {/* 搜索结果或搜索历史 */}
        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {showResults ? (
            <section className='mb-12'>
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
                
                <AggregateToggle viewMode={viewMode} setViewMode={setViewMode} />
              </div>
              
              {searchResults.length === 0 ? (
                isLoading ? (
                  <div className='flex justify-center items-center h-40'>
                    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
                  </div>
                ) : (
                  <div className='text-center text-gray-500 py-8 dark:text-gray-400'>
                    未找到相关结果
                  </div>
                )
              ) : (
                <ResultsGrid
                  viewMode={viewMode}
                  filteredAllResults={filteredAllResults}
                  filteredAggResults={filteredAggResults}
                  searchQuery={searchQuery}
                  getGroupRef={getGroupRef}
                  computeGroupStats={computeGroupStats}
                />
              )}
            </section>
          ) : searchHistory.length > 0 ? (
            <SearchHistorySection
              searchHistory={searchHistory}
              onSearch={handleSuggestionSelect}
              onDelete={deleteHistory}
              onClear={clearHistory}
            />
          ) : null}
        </div>
      </div>

      <BackToTopButton show={showBackToTop} onClick={scrollToTop} />
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
