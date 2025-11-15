/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any,@typescript-eslint/no-non-null-assertion,no-empty */
'use client';

import { ChevronUp, Search, X, Film, Tv, HelpCircle, RotateCw } from 'lucide-react';
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
  DEBOUNCE_DELAY: 300,
} as const;

// 错误边界组件
class SearchErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Search Page Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-96 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            页面加载失败
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
            搜索页面出现了一些问题，请刷新页面重试。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors duration-200"
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 防抖 Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 计算管理器
class SearchComputeManager {
  private similarityCache = new Map<string, number>();

  calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1.0;

    const cacheKey = `${str1}|${str2}`;
    if (this.similarityCache.has(cacheKey)) {
      return this.similarityCache.get(cacheKey)!;
    }

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      this.similarityCache.set(cacheKey, 1.0);
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
    
    if (this.similarityCache.size > SEARCH_CONFIG.MAX_CACHE_SIZE) {
      const firstKey = this.similarityCache.keys().next().value;
      this.similarityCache.delete(firstKey);
    }
    
    this.similarityCache.set(cacheKey, similarity);
    return similarity;
  }

  aggregateResults(results: SearchResult[], query: string): [string, SearchResult[]][] {
    const normalizedQuery = query.trim().toLowerCase();
    
    if (!normalizedQuery) return [];

    const relevantResults = results.filter((item) => {
      const title = item.title.toLowerCase();
      
      if (title === normalizedQuery) return true;
      if (title.includes(normalizedQuery)) return true;
      if (normalizedQuery.length <= 2) {
        return title.replace(/\s+/g, '').includes(normalizedQuery.replace(/\s+/g, ''));
      }

      return this.calculateSimilarity(title, normalizedQuery) > SEARCH_CONFIG.SIMILARITY_THRESHOLD;
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

    return keyOrder.map((key) => [key, map.get(key)!]);
  }

  destroy() {
    this.similarityCache.clear();
  }
}

// 增强的 TypeScript 类型定义
interface SearchState {
  query: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  results: SearchResult[];
  error: string | null;
  totalSources: number;
  completedSources: number;
}

type SearchAction = 
  | { type: 'SEARCH_START'; payload: { query: string; totalSources?: number } }
  | { type: 'SEARCH_RESULT'; payload: SearchResult[] }
  | { type: 'SEARCH_SOURCE_COMPLETE' }
  | { type: 'SEARCH_SUCCESS'; payload: SearchResult[] }
  | { type: 'SEARCH_ERROR'; payload: string }
  | { type: 'SEARCH_RESET' }
  | { type: 'SEARCH_COMPLETE' };

const searchReducer = (state: SearchState, action: SearchAction): SearchState => {
  switch (action.type) {
    case 'SEARCH_START':
      return {
        ...state,
        query: action.payload.query,
        status: 'loading',
        error: null,
        totalSources: action.payload.totalSources || 0,
        completedSources: 0,
        results: [],
      };
    case 'SEARCH_RESULT':
      return {
        ...state,
        results: [...state.results, ...action.payload],
      };
    case 'SEARCH_SOURCE_COMPLETE':
      return {
        ...state,
        completedSources: Math.min(state.completedSources + 1, state.totalSources || 1),
      };
    case 'SEARCH_SUCCESS':
      return {
        ...state,
        status: 'success',
        results: action.payload,
        completedSources: state.totalSources || 1,
      };
    case 'SEARCH_COMPLETE':
      return {
        ...state,
        status: 'success',
        completedSources: state.totalSources,
      };
    case 'SEARCH_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.payload,
      };
    case 'SEARCH_RESET':
      return {
        query: '',
        status: 'idle',
        results: [],
        error: null,
        totalSources: 0,
        completedSources: 0,
      };
    default:
      return state;
  }
};

// 可访问性改进的组件
const AccessibleSearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  isLoading?: boolean;
}> = ({ value, onChange, onFocus, onSubmit, onClear, isLoading }) => {
  return (
    <form onSubmit={onSubmit} className="max-w-2xl mx-auto" role="search">
      <div className="relative">
        <label htmlFor="searchInput" className="sr-only">
          搜索电影、电视剧
        </label>
        <Search 
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500" 
          aria-hidden="true"
        />
        <input
          id="searchInput"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder="搜索电影、电视剧..."
          autoComplete="off"
          aria-describedby="searchHelp"
          aria-busy={isLoading}
          className="w-full h-12 rounded-lg bg-gray-50/80 py-3 pl-10 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700"
        />

        {value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300"
            aria-label="清除搜索内容"
            disabled={isLoading}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div id="searchHelp" className="sr-only">
        输入电影或电视剧名称进行搜索，支持中文和英文名称。输入时会有搜索建议显示，按回车键或点击搜索按钮进行搜索。
      </div>
    </form>
  );
};

function SearchPageClient() {
  // 使用 reducer 管理搜索状态
  const [searchState, dispatch] = React.useReducer(searchReducer, {
    query: '',
    status: 'idle',
    results: [],
    error: null,
    totalSources: 0,
    completedSources: 0,
  });

  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [useFluidSearch, setUseFluidSearch] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  // 使用防抖的搜索查询
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_CONFIG.DEBOUNCE_DELAY);

  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQueryRef = useRef<string>('');
  
  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingResultsRef = useRef<SearchResult[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const computeManagerRef = useRef<SearchComputeManager | null>(null);

  // 过滤器状态
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

  // 初始化计算管理器
  useEffect(() => {
    computeManagerRef.current = new SearchComputeManager();
    return () => {
      computeManagerRef.current?.destroy();
    };
  }, []);

  // 统一的资源清理函数
  const cleanupResources = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    
    pendingResultsRef.current = [];
  }, []);

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

  // 统一搜索执行函数
  const executeSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    const trimmed = query.trim().replace(/\s+/g, ' ');
    
    // 重置状态
    dispatch({ type: 'SEARCH_START', payload: { query: trimmed } });
    setShowResults(true);
    setShowSuggestions(false);
    setHasSearched(true);

    // 清理之前的资源
    cleanupResources();

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [router, cleanupResources]);

  // 优化事件处理函数
  const handleInputChange = useCallback((value: string) => {
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
    executeSearch(searchQuery);
  }, [searchQuery, executeSearch]);

  const handleEnterKey = useCallback(() => {
    executeSearch(searchQuery);
  }, [searchQuery, executeSearch]);

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    executeSearch(suggestion);
  }, [executeSearch]);

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
    if (pendingResultsRef.current.length > 0 && isMountedRef.current) {
      const toAppend = pendingResultsRef.current;
      pendingResultsRef.current = [];
      startTransition(() => {
        dispatch({ type: 'SEARCH_RESULT', payload: toAppend });
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

  // 使用计算管理器进行聚合计算
  const aggregatedResults = useMemo(() => {
    const query = currentQueryRef.current.trim().toLowerCase();
    
    if (!query || searchState.results.length === 0) return [];

    // 检查缓存
    const cacheKey = `${query}-${searchState.results.length}-${searchState.results
      .slice(0, 3)
      .map(r => r.id)
      .join('-')}`;
    
    if (aggregationCacheRef.current.key === cacheKey) {
      return aggregationCacheRef.current.results;
    }

    // 使用计算管理器进行聚合
    if (computeManagerRef.current) {
      const results = computeManagerRef.current.aggregateResults(searchState.results, query);
      aggregationCacheRef.current = { key: cacheKey, results };
      return results;
    }

    return [];
  }, [searchState.results]);

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

  // 构建筛选选项 - 优化缓存策略
  const filterOptions = useMemo(() => {
    if (searchState.results.length === 0) {
      return { categoriesAll: [], categoriesAgg: [] };
    }

    const cacheKey = searchState.results.map(r => `${r.source}-${r.title}-${r.year}`).join('|');
    const cached = sessionStorage.getItem(`filterOptions-${cacheKey}`);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const sourcesSet = new Map<string, string>();
    const titlesSet = new Set<string>();
    const yearsSet = new Set<string>();

    searchState.results.forEach((item) => {
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
    
    // 只在有结果时缓存
    sessionStorage.setItem(`filterOptions-${cacheKey}`, JSON.stringify(result));
    
    return result;
  }, [searchState.results]);

  // 非聚合：应用筛选与排序
  const filteredAllResults = useMemo(() => {
    const { source, title, year, yearOrder } = filterAll;
    const filtered = searchState.results.filter((item) => {
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
  }, [searchState.results, filterAll, searchQuery, compareYear]);

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

  // 渲染优化的加载状态组件
  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500"></div>
        <Search className="absolute inset-0 m-auto h-6 w-6 text-green-500" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          正在搜索中...
        </h3>
        {useFluidSearch && searchState.totalSources > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            已搜索 {searchState.completedSources}/{searchState.totalSources} 个来源
          </div>
        )}
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 max-w-md">
          正在从多个数据源搜索 "<span className="font-medium text-green-600">{currentQueryRef.current}</span>"，请稍候...
        </div>
      </div>
    </div>
  );

  // 渲染错误状态组件
  const renderErrorState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-6 relative">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
          <X className="h-10 w-10 text-red-500 dark:text-red-400" />
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
        搜索失败
      </h3>
      
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {searchState.error || "搜索过程中出现错误，请重试"}
      </p>

      <button
        onClick={() => executeSearch(currentQueryRef.current)}
        className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors duration-200 flex items-center gap-2"
        aria-label="重新搜索"
      >
        <RotateCw className="h-4 w-4" aria-hidden="true" />
        重新搜索
      </button>
    </div>
  );

  // 渲染空状态组件
  const renderEmptyState = () => {
    const query = currentQueryRef.current;
    
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="mb-6 relative">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <HelpCircle className="h-10 w-10 text-gray-400 dark:text-gray-500" aria-hidden="true" />
          </div>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          未找到相关结果
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          没有找到与 "<span className="font-medium text-gray-900 dark:text-gray-100">{query}</span>" 相关的影视内容
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-w-lg w-full">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Film className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span className="font-medium text-blue-900 dark:text-blue-100">搜索建议</span>
            </div>
            <ul className="text-sm text-blue-700 dark:text-blue-300 text-left space-y-1">
              <li>• 检查关键词拼写</li>
              <li>• 尝试更通用的名称</li>
              <li>• 使用影片的英文名</li>
            </ul>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Tv className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
              <span className="font-medium text-green-900 dark:text-green-100">其他尝试</span>
            </div>
            <ul className="text-sm text-green-700 dark:text-green-300 text-left space-y-1">
              <li>• 搜索导演或演员</li>
              <li>• 使用年份+名称</li>
              <li>• 简化的关键词</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => {
              setSearchQuery('');
              document.getElementById('searchInput')?.focus();
            }}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors duration-200 flex items-center gap-2"
            aria-label="重新搜索"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            重新搜索
          </button>
          
          <button
            onClick={() => {
              dispatch({ type: 'SEARCH_RESET' });
              setShowResults(false);
              setHasSearched(false);
              setSearchQuery('');
            }}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full transition-colors duration-200"
            aria-label="返回首页"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  };

  // 渲染搜索结果内容
  const renderSearchResults = () => {
    if (searchState.error) {
      return renderErrorState();
    }

    if (searchState.status === 'loading') {
      return renderLoadingState();
    }

    if (searchState.results.length === 0 && hasSearched) {
      return renderEmptyState();
    }

    if (searchState.results.length > 0) {
      return (
        <div
          key={`search-results-${viewMode}`}
          className="justify-start grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 px-2"
        >
          {viewMode === 'agg' 
            ? filteredAggResults.map(([mapKey, group], index) => {
                const title = group[0]?.title || '';
                const poster = group[0]?.poster || '';
                const year = group[0]?.year || 'unknown';
                const { episodes, source_names, douban_id } = computeGroupStats(group);
                const type = episodes === 1 ? 'movie' : 'tv';

                if (!groupStatsRef.current.has(mapKey)) {
                  groupStatsRef.current.set(mapKey, { episodes, source_names, douban_id });
                }

                return (
                  <div key={`agg-${mapKey}-${index}`} className='w-full'>
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
            : filteredAllResults.map((item, index) => (
                <div
                  key={`all-${item.source}-${item.id}-${index}`}
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

    return null;
  };

  // 主 useEffect - 优化资源管理
  useEffect(() => {
    isMountedRef.current = true;

    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    getSearchHistory().then((history) => {
      if (isMountedRef.current) setSearchHistory(history);
    });

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

    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        if (isMountedRef.current) setSearchHistory(newHistory);
      }
    );

    document.body.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
      document.body.removeEventListener('scroll', handleScroll);
      cleanupResources();
    };
  }, [searchParams, handleScroll, cleanupResources]);

  // 搜索参数变化处理 - 修复计数逻辑和完成状态
  useEffect(() => {
    let isActive = true;

    const query = searchParams.get('q') || '';
    const trimmedQuery = query.trim();
    currentQueryRef.current = trimmedQuery;

    if (query) {
      setSearchQuery(query);
      setHasSearched(true);
      
      if (currentQueryRef.current !== trimmedQuery) {
        dispatch({ type: 'SEARCH_RESET' });
        pendingResultsRef.current = [];
      }
      
      setShowResults(true);
      cleanupResources();

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

      const handleSearchError = (error: string) => {
        if (isActive) {
          dispatch({ type: 'SEARCH_ERROR', payload: error });
        }
      };

      if (currentFluidSearch) {
        // 流式搜索 - 修复计数逻辑
        const es = new EventSource(
          `/api/search/ws?q=${encodeURIComponent(trimmedQuery)}`
        );
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (!event.data || !isActive || currentQueryRef.current !== trimmedQuery) return;
          
          try {
            const payload = JSON.parse(event.data);
            
            switch (payload.type) {
              case 'start':
                dispatch({ 
                  type: 'SEARCH_START', 
                  payload: { 
                    query: trimmedQuery, 
                    totalSources: payload.totalSources || 0 
                  } 
                });
                break;
              case 'source_result':
                if (payload.results?.length) {
                  pendingResultsRef.current.push(...payload.results);
                  if (!flushTimerRef.current) {
                    flushTimerRef.current = window.setTimeout(() => {
                      flushPendingResults();
                      flushTimerRef.current = null;
                    }, SEARCH_CONFIG.RESULTS_FLUSH_DELAY);
                  }
                }
                dispatch({ type: 'SEARCH_SOURCE_COMPLETE' });
                break;
              case 'source_error':
                dispatch({ type: 'SEARCH_SOURCE_COMPLETE' });
                handleSearchError(`搜索源 ${payload.source} 出错`);
                break;
              case 'complete':
                flushPendingResults();
                if (isActive) {
                  dispatch({ type: 'SEARCH_COMPLETE' });
                }
                es.close();
                if (eventSourceRef.current === es) {
                  eventSourceRef.current = null;
                }
                break;
            }
          } catch (error) {
            console.error('Parse search event error:', error);
            handleSearchError('解析搜索结果时出错');
          }
        };

        es.onerror = () => {
          handleSearchError('搜索连接出错');
          es.close();
          if (eventSourceRef.current === es) {
            eventSourceRef.current = null;
          }
        };
      } else {
        // 传统搜索
        fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            if (!isActive || currentQueryRef.current !== trimmedQuery) return;

            if (data.results && Array.isArray(data.results)) {
              dispatch({ 
                type: 'SEARCH_SUCCESS', 
                payload: data.results as SearchResult[] 
              });
            }
          })
          .catch((error) => {
            if (isActive) {
              handleSearchError(`搜索失败: ${error.message}`);
            }
          });
      }
      
      setShowSuggestions(false);
      addSearchHistory(query);
    } else {
      setShowResults(false);
      setShowSuggestions(false);
      setHasSearched(false);
      dispatch({ type: 'SEARCH_RESET' });
    }

    return () => {
      isActive = false;
    };
  }, [searchParams, useFluidSearch, flushPendingResults, cleanupResources]);

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        <div className='mb-8'>
          <AccessibleSearchInput
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onSubmit={handleSearch}
            onClear={() => {
              setSearchQuery('');
              setShowSuggestions(false);
              document.getElementById('searchInput')?.focus();
            }}
            isLoading={searchState.status === 'loading'}
          />

          <SearchSuggestions
            query={debouncedSearchQuery}
            isVisible={showSuggestions}
            onSelect={handleSuggestionSelect}
            onClose={() => setShowSuggestions(false)}
            onEnterKey={handleEnterKey}
          />
        </div>

        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {showResults ? (
            <section className='mb-12' aria-live="polite" aria-atomic="true">
              <div className='mb-6'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                  {searchState.status === 'loading' ? '搜索中...' : '搜索结果'}
                  {searchState.totalSources > 0 && useFluidSearch && (
                    <span className='ml-2 text-sm font-normal text-gray-500 dark:text-gray-400'>
                      {searchState.completedSources}/{searchState.totalSources}
                    </span>
                  )}
                </h2>
                {searchState.status === 'success' && searchState.results.length > 0 && (
                  <p className='text-sm text-gray-600 dark:text-gray-400 mt-2'>
                    找到 {viewMode === 'agg' ? filteredAggResults.length : filteredAllResults.length} 个结果
                    {searchQuery && (
                      <span>，搜索词: "<span className='font-medium'>{searchQuery}</span>"</span>
                    )}
                  </p>
                )}
              </div>
              
              {searchState.results.length > 0 && (
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
                        aria-label="切换聚合显示模式"
                      />
                      <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                      <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                    </div>
                  </label>
                </div>
              )}

              {renderSearchResults()}
            </section>
          ) : searchHistory.length > 0 ? (
            <section className='mb-12'>
              <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                搜索历史
                {searchHistory.length > 0 && (
                  <button
                    onClick={() => {
                      clearSearchHistory();
                    }}
                    className='ml-3 text-sm text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400 dark:hover:text-red-500'
                    aria-label="清空搜索历史"
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
                      aria-label={`搜索 ${item}`}
                    >
                      {item}
                    </button>
                    <button
                      aria-label={`删除搜索历史 ${item}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        deleteSearchHistory(item);
                      }}
                      className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                    >
                      <X className='w-3 h-3' aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 md:bottom-6 right-6 z-[500] w-12 h-12 bg-green-500/90 hover:bg-green-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label='返回顶部'
      >
        <ChevronUp className='w-6 h-6 transition-transform group-hover:scale-110' aria-hidden="true" />
      </button>
    </PageLayout>
  );
}

function SearchPageWithErrorBoundary() {
  return (
    <SearchErrorBoundary>
      <SearchPageClient />
    </SearchErrorBoundary>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    }>
      <SearchPageWithErrorBoundary />
    </Suspense>
  );
}
