/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

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
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

function HomeClient() {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [bangumiCalendarData, setBangumiCalendarData] = useState<
    BangumiCalendarData[]
  >([]);
  const [loading, setLoading] = useState(true);
  const { announcement } = useSite();

  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
  }, [announcement]);

  // 收藏夹数据
  type FavoriteItem = {
    id: string;
    source: string;
    title: string;
    poster: string;
    episodes: number;
    source_name: string;
    currentEpisode?: number;
    search_title?: string;
    origin?: 'vod' | 'live';
  };

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    const fetchRecommendData = async () => {
      try {
        setLoading(true);

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

        if (moviesData.code === 200) {
          setHotMovies(moviesData.list);
        }

        if (tvShowsData.code === 200) {
          setHotTvShows(tvShowsData.list);
        }

        if (varietyShowsData.code === 200) {
          setHotVarietyShows(varietyShowsData.list);
        }

        setBangumiCalendarData(bangumiCalendarData);
      } catch (error) {
        console.error('获取推荐数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendData();
  }, []);

  // 处理收藏数据更新的函数
  const updateFavoriteItems = async (allFavorites: Record<string, any>) => {
    const allPlayRecords = await getAllPlayRecords();

    const sorted = Object.entries(allFavorites)
      .sort(([, a], [, b]) => b.save_time - a.save_time)
      .map(([key, fav]) => {
        const plusIndex = key.indexOf('+');
        const source = key.slice(0, plusIndex);
        const id = key.slice(plusIndex + 1);

        const playRecord = allPlayRecords[key];
        const currentEpisode = playRecord?.index;

        return {
          id,
          source,
          title: fav.title,
          year: fav.year,
          poster: fav.cover,
          episodes: fav.total_episodes,
          source_name: fav.source_name,
          currentEpisode,
          search_title: fav?.search_title,
          origin: fav?.origin,
        } as FavoriteItem;
      });
    setFavoriteItems(sorted);
  };

  // 当切换到收藏夹时加载收藏数据
  useEffect(() => {
    if (activeTab !== 'favorites') return;

    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };

    loadFavorites();

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [activeTab]);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', announcement);
  };

  return (
    <PageLayout>
      <div className="px-2 sm:px-10 py-4 sm:py-8 overflow-visible">
        {/* 顶部 Tab 切换 */}
        <div className="mb-8 flex justify-center">
          <CapsuleSwitch
            options={[
              { label: '首页', value: 'home' },
              { label: '收藏夹', value: 'favorites' },
            ]}
            active={activeTab}
            onChange={(value) => setActiveTab(value as 'home' | 'favorites')}
          />
        </div>

        <div className="max-w-[95%] mx-auto">
          {activeTab === 'favorites' ? (
            // 收藏夹视图
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                  我的收藏
                </h2>
                {favoriteItems.length > 0 && (
                  <button
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={async () => {
                      await clearAllFavorites();
                      setFavoriteItems([]);
                    }}
                  >
                    清空
                  </button>
                )}
              </div>
              <div className="justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8">
                {favoriteItems.map((item) => (
                  <div key={item.id + item.source} className="w-full">
                    <VideoCard
                      query={item.search_title}
                      {...item}
                      from="favorite"
                      type={item.episodes > 1 ? 'tv' : ''}
                    />
                  </div>
                ))}
                {favoriteItems.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-8 dark:text-gray-400">
                    暂无收藏内容
                  </div>
                )}
              </div>
            </section>
          ) : (
            // 首页视图
            <>
              {/* 继续观看 */}
              <ContinueWatching />

              {/* 热门电影 */}
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    热门电影
                  </h2>
                  <Link
                    href="/douban?type=movie"
                    className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    查看更多
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
                <ScrollableRow>
                  {loading
                    ? Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={index}
                          className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44"
                        >
                          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800">
                            <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700"></div>
                          </div>
                          <div className="mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800"></div>
                        </div>
                      ))
                    : hotMovies.map((movie, index) => (
                        <div
                          key={index}
                          className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44"
                        >
                          <VideoCard
                            from="douban"
                            title={movie.title}
                            poster={movie.poster}
                            douban_id={Number(movie.id)}
                            rate={movie.rate}
                            year={movie.year}
                            type="movie"
                          />
                        </div>
                      ))}
                </ScrollableRow>
              </section>

              {/* 热门剧集 */}
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    热门剧集
                  </h2>
                  <Link
                    href="/douban?type=tv"
                    className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    查看更多
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
                <ScrollableRow>
                  {loading
                    ? Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={index}
                          className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44"
                        >
                          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800">
                            <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700"></div>
                          </div>
                          <div className="mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800"></div>
                        </div>
                      ))
                    : hotTvShows.map((show, index) => (
                        <div
                          key={index}
                          className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44"
                        >
                          <VideoCard
                            from="douban"
                            title={show.title}
                            poster={show.poster}
                            douban_id={Number(show.id)}
                            rate={show.rate}
                            year={show.year}
                          />
                        </div>
                      ))}
                </ScrollableRow>
              </section>

              {/* 每日新番放送 */}
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    新番放送
                  </h2>
                  <Link
                    href="/douban?type=anime"
                    className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    查看更多
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
                <ScrollableRow>
                  {loading
                    ? Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={index}
                          className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44"
                        >
                          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800">
                            <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700"></div>
                          </div>
                          <div className="mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800"></div>
                        </div>
                      ))
                    : (() => {
                        const today = new Date();
                        const weekdays = [
                          'Sun',
                          'Mon',
                          'Tue',
                          'Wed',
                          'Thu',
                          'Fri',
                          'Sat',
                        ];
                        const currentWeekday = weekdays[today.getDay()];

                        const todayAnimes =
                          bangumiCalendarData.find(
                            (item) => item.weekday.en === currentWeekday
                          )?.items || [];

                        const validAnimes = todayAnimes.filter(
                          (anime) => anime && anime.id
                        );

                        return validAnimes.map((anime, index) => (
                          <div
                            key={`${anime.id}-${index}`}
                            className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44"
                          >
                            <VideoCard
                              from="douban"
                              title={anime.name_cn || anime.name}
                              poster={
                                anime.images?.large ||
                                anime.images?.common ||
                                anime.images?.medium ||
                                anime.images?.small ||
                                anime.images?.grid ||
                                '/logo.png'
                              }
                              douban_id={anime.id}
                              rate={anime.rating?.score?.toFixed(1) || ''}
                              year={anime.air_date?.split('-')?.[0] || ''}
                              isBangumi={true}
                            />
                          </div>
                        ));
                      })()}
                </ScrollableRow>
              </section>

              {/* 热门综艺 */}
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    热门综艺
                  </h2>
                  <Link
                    href="/douban?type=show"
                    className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    查看更多
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
                <ScrollableRow>
                  {loading
                    ? Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={index}
                          className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44"
                        >
                          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800">
                            <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700"></div>
                          </div>
                          <div className="mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800"></div>
                        </div>
                      ))
                    : hotVarietyShows.map((show, index) => (
                        <div
                          key={index}
                          className="min-w-[96px] w-24 sm:min-w-[180px] sm:w-44"
                        >
                          <VideoCard
                            from="douban"
                            title={show.title}
                            poster={show.poster}
                            douban_id={Number(show.id)}
                            rate={show.rate}
                            year={show.year}
                          />
                        </div>
                      ))}
                </ScrollableRow>
              </section>
            </>
          )}
        </div>
      </div>
      {announcement && showAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm dark:bg-black/70 p-4"
          style={{ touchAction: 'none' }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
            style={{ touchAction: 'auto' }}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                公告
              </h3>
              <button
                onClick={() => handleCloseAnnouncement(announcement)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="关闭"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="mb-6">
              <div className="relative overflow-hidden rounded-lg mb-4 p-4 bg-gray-100 dark:bg-gray-800"
              >
                <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                  {announcement}
                </p>
              </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className="w-full rounded-lg bg-gray-600 px-4 py-3 text-white font-medium hover:bg-gray-700 transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
