/* eslint-disable react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState, useCallback, useMemo, memo } from 'react';

import {
  BangumiCalendarData,
  GetBangumiCalendarData,
} from '@/lib/bangumi.client';
import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import ScrollableRow from '@/components/ScrollableRow';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

// 定义明确的类型
interface FavoriteItem {
  id: string;
  source: string;
  title: string;
  poster: string;
  episodes: number;
  source_name: string;
  currentEpisode?: number;
  search_title?: string;
  origin?: 'vod' | 'live';
  year?: number;
}

interface RecommendData {
  movies: DoubanItem[];
  tvShows: DoubanItem[];
  varietyShows: DoubanItem[];
  bangumiCalendar: BangumiCalendarData[];
}

// 使用 React.memo 优化子组件
const LoadingPlaceholder = memo(({ count }: { count: number }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
      >
        <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
          <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
        </div>
        <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
      </div>
    ))}
  </>
));

LoadingPlaceholder.displayName = 'LoadingPlaceholder';

const SectionHeader = memo(({ 
  title, 
  href, 
  onClear, 
  showClearButton = false 
}: { 
  title: string; 
  href?: string; 
  onClear?: () => void; 
  showClearButton?: boolean; 
}) => (
  <div className='mb-4 flex items-center justify-between'>
    <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
      {title}
    </h2>
    <div className='flex items-center'>
      {showClearButton && favoriteItems.length > 0 && (
        <button
          className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mr-4'
          onClick={onClear}
        >
          清空
        </button>
      )}
      {href && (
        <Link
          href={href}
          className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        >
          查看更多
          <ChevronRight className='w-4 h-4 ml-1' />
        </Link>
      )}
    </div>
  </div>
));

SectionHeader.displayName = 'SectionHeader';

const AnnouncementModal = memo(({ 
  announcement, 
  onClose 
}: { 
  announcement: string; 
  onClose: (announcement: string) => void; 
}) => {
  const handleClose = useCallback(() => {
    onClose(announcement);
  }, [announcement, onClose]);

  if (!announcement) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">公告</h3>
        <p className="text-gray-700 dark:text-gray-300 mb-6">{announcement}</p>
        <button
          onClick={handleClose}
          className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          我知道了
        </button>
      </div>
    </div>
  );
});

AnnouncementModal.displayName = 'AnnouncementModal';

function HomeClient() {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [recommendData, setRecommendData] = useState<RecommendData>({
    movies: [],
    tvShows: [],
    varietyShows: [],
    bangumiCalendar: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { announcement } = useSite();
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  // 使用 useMemo 缓存计算昂贵的值[1](@ref)[5](@ref)
  const hotMovies = useMemo(() => recommendData.movies, [recommendData.movies]);
  const hotTvShows = useMemo(() => recommendData.tvShows, [recommendData.tvShows]);
  const hotVarietyShows = useMemo(() => recommendData.varietyShows, [recommendData.varietyShows]);
  const bangumiCalendarData = useMemo(() => recommendData.bangumiCalendar, [recommendData.bangumiCalendar]);

  // 使用 useCallback 优化事件处理函数[1](@ref)[2](@ref)
  const handleCloseAnnouncement = useCallback((currentAnnouncement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', currentAnnouncement);
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as 'home' | 'favorites');
  }, []);

  const handleClearFavorites = useCallback(async () => {
    await clearAllFavorites();
    setFavoriteItems([]);
  }, []);

  // 使用 useCallback 优化数据获取函数[2](@ref)
  const fetchRecommendData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [moviesData, tvShowsData, varietyShowsData, bangumiCalendarData] =
        await Promise.all([
          getDoubanCategories({
            kind: 'movie',
            category: '热门',
            type: '全部',
          }),
          getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
          getDoubanCategories({ kind: 'tv', category: 'show', type: 'show' }),
          GetBangumiCalendarData(),
        ]);

      if (moviesData.code === 200 && tvShowsData.code === 200 && varietyShowsData.code === 200) {
        setRecommendData({
          movies: moviesData.list || [],
          tvShows: tvShowsData.list || [],
          varietyShows: varietyShowsData.list || [],
          bangumiCalendar: bangumiCalendarData,
        });
      } else {
        throw new Error('获取数据失败');
      }
    } catch (err) {
      console.error('获取推荐数据失败:', err);
      setError('加载失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }, []);

  // 使用 useCallback 优化收藏项更新函数[1](@ref)
  const updateFavoriteItems = useCallback(async (allFavorites: Record<string, any>) => {
    try {
      const allPlayRecords = await getAllPlayRecords();

      const sorted = Object.entries(allFavorites)
        .sort(([, a], [, b]) => (b.save_time || 0) - (a.save_time || 0))
        .map(([key, fav]) => {
          const plusIndex = key.indexOf('+');
          const source = key.slice(0, plusIndex);
          const id = key.slice(plusIndex + 1);

          const playRecord = allPlayRecords[key];
          const currentEpisode = playRecord?.index;

          return {
            id,
            source,
            title: fav.title || '',
            year: fav.year,
            poster: fav.cover || '',
            episodes: fav.total_episodes || 0,
            source_name: fav.source_name || '',
            currentEpisode,
            search_title: fav?.search_title,
            origin: fav?.origin,
          } as FavoriteItem;
        })
        .filter(item => item.title); // 过滤掉无效数据

      setFavoriteItems(sorted);
    } catch (err) {
      console.error('更新收藏项失败:', err);
    }
  }, []);

  // 使用 useEffect 处理副作用
  useEffect(() => {
    fetchRecommendData();
  }, [fetchRecommendData]);

  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      setShowAnnouncement(hasSeenAnnouncement !== announcement);
    }
  }, [announcement]);

  useEffect(() => {
    if (activeTab !== 'favorites') return;

    const loadFavorites = async () => {
      try {
        const allFavorites = await getAllFavorites();
        await updateFavoriteItems(allFavorites);
      } catch (err) {
        console.error('加载收藏失败:', err);
      }
    };

    loadFavorites();

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [activeTab, updateFavoriteItems]);

  // 渲染收藏夹内容
  const renderFavorites = useMemo(() => {
    if (activeTab !== 'favorites') return null;

    return (
      <section className='mb-8'>
        <SectionHeader
          title="我的收藏"
          onClear={handleClearFavorites}
          showClearButton={favoriteItems.length > 0}
        />
        <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'>
          {favoriteItems.length > 0 ? (
            favoriteItems.map((item) => (
              <div key={`${item.id}-${item.source}`} className='w-full'>
                <VideoCard
                  query={item.search_title}
                  {...item}
                  from='favorite'
                  type={item.episodes > 1 ? 'tv' : ''}
                />
              </div>
            ))
          ) : (
            <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
              暂无收藏内容
            </div>
          )}
        </div>
      </section>
    );
  }, [activeTab, favoriteItems, handleClearFavorites]);

  // 渲染首页内容
  const renderHomeContent = useMemo(() => {
    if (activeTab !== 'home') return null;

    return (
      <>
        <ContinueWatching />
        
        {/* 热门电影 */}
        <section className='mb-8'>
          <SectionHeader title="热门电影" href="/douban?type=movie" />
          <ScrollableRow>
            {loading ? (
              <LoadingPlaceholder count={8} />
            ) : (
              hotMovies.map((movie) => (
                <div key={movie.id} className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'>
                  <VideoCard {...movie} />
                </div>
              ))
            )}
          </ScrollableRow>
        </section>

        {/* 热门剧集 */}
        <section className='mb-8'>
          <SectionHeader title="热门剧集" href="/douban?type=tv" />
          <ScrollableRow>
            {loading ? (
              <LoadingPlaceholder count={8} />
            ) : (
              hotTvShows.map((show) => (
                <div key={show.id} className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'>
                  <VideoCard {...show} />
                </div>
              ))
            )}
          </ScrollableRow>
        </section>

        {/* 热门综艺 */}
        <section className='mb-8'>
          <SectionHeader title="热门综艺" href="/douban?type=show" />
          <ScrollableRow>
            {loading ? (
              <LoadingPlaceholder count={8} />
            ) : (
              hotVarietyShows.map((variety) => (
                <div key={variety.id} className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'>
                  <VideoCard {...variety} />
                </div>
              ))
            )}
          </ScrollableRow>
        </section>
      </>
    );
  }, [activeTab, loading, hotMovies, hotTvShows, hotVarietyShows]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchRecommendData}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <nav 
        className="fixed top-0 left-0 right-0 z-[9999] h-16 bg-gray-900/95 backdrop-blur-md border-b border-gray-700"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999
        }}
      >
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-xl font-bold text-white">DecoTV</span>
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-white hover:text-purple-300 transition-colors">
              首页
            </Link>
            <Link href="/search" className="text-white hover:text-purple-300 transition-colors">
              搜索
            </Link>
            <Link href="/douban" className="text-white hover:text-purple-300 transition-colors">
              豆瓣
            </Link>
          </div>
        </div>
      </nav>

      <div style={{ marginTop: '64px' }}>
        <div className='px-2 sm:px-10 py-4 sm:py-8 overflow-visible'>
          <div className='mb-8 flex justify-center'>
            <CapsuleSwitch
              options={[
                { label: '首页', value: 'home' },
                { label: '收藏夹', value: 'favorites' },
              ]}
              active={activeTab}
              onChange={handleTabChange}
            />
          </div>

          <div className='max-w-[95%] mx-auto'>
            {renderHomeContent}
            {renderFavorites}
          </div>
        </div>
      </div>

      {showAnnouncement && announcement && (
        <AnnouncementModal 
          announcement={announcement} 
          onClose={handleCloseAnnouncement} 
        />
      )}
    </div>
  );
}

export default memo(HomeClient);
