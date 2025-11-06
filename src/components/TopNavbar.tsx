/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Cat, Clover, Film, Home, Radio, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import React, { useState } from 'react';

import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export default function TopNavbar() {
  const { siteName } = useSite();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [clickedItem, setClickedItem] = useState<string | null>(null);

  const isActive = (href: string) => {
    return pathname === href;
  };

  const isDoubanActive = (type: string) => {
    const currentType = searchParams.get('type');
    return pathname.startsWith('/douban') && currentType === type;
  };

  const handleClick = (href: string) => {
    setClickedItem(href);
    // 300ms后重置点击状态，避免颜色一直保持
    setTimeout(() => {
      setClickedItem(null);
    }, 300);
  };

  // 导航项配置
  const navItems = [
    { href: '/', label: '首页', icon: Home, tooltip: '返回首页' },
    { href: '/search', label: '搜索', icon: Search, tooltip: '搜索内容' },
    { href: '/douban?type=movie', label: '电影', icon: Film, tooltip: '浏览电影', isDouban: 'movie' },
    { href: '/douban?type=tv', label: '剧集', icon: Tv, tooltip: '浏览剧集', isDouban: 'tv' },
    { href: '/douban?type=anime', label: '动漫', icon: Cat, tooltip: '浏览动漫', isDouban: 'anime' },
    { href: '/douban?type=show', label: '综艺', icon: Clover, tooltip: '浏览综艺', isDouban: 'show' },
    { href: '/live', label: '直播', icon: Radio, tooltip: '观看直播' },
  ];

  return (
    <header className='hidden md:block fixed top-0 left-0 right-0 z-[900]'>
      <div className='mx-auto max-w-7xl px-4'>
        <div className='mt-2 rounded-2xl border border-white/10 bg-white/30 dark:bg-gray-900/40 shadow-[0_0_1px_0_rgba(255,255,255,0.5),0_0_40px_-10px_rgba(59,130,246,0.5)] backdrop-blur-xl'>
          <nav className='flex items-center justify-between h-14 px-3'>
            {/* Left: Logo */}
            <div className='flex items-center gap-2 min-w-0'>
              <Link
                href='/'
                className='shrink-0 select-none hover:opacity-90 transition-opacity group relative'
                onClick={() => handleClick('/')}
              >
                <span className={`text-lg font-extrabold tracking-tight neon-text transition-colors ${
                  clickedItem === '/' ? 'text-red-500' : ''
                }`}>
                  {siteName || 'DecoTV'}
                </span>
                <div className='absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300' />
              </Link>
            </div>

            {/* Center: Controls */}
            <div className='flex items-center justify-center gap-2 flex-wrap'>
              {navItems.map((item) => {
                const isItemActive = item.isDouban 
                  ? isDoubanActive(item.isDouban)
                  : isActive(item.href);
                const isClicked = clickedItem === item.href;

                return (
                  <div key={item.href} className='relative group'>
                    <Link
                      href={item.href}
                      onClick={() => handleClick(item.href)}
                      className={`
                        inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm 
                        transition-all duration-300 glass-chip
                        transform hover:scale-105 active:scale-95
                        /* 悬停背景色 - 统一的淡蓝色 */
                        hover:bg-blue-50/80 dark:hover:bg-blue-900/20
                        /* 活动状态 */
                        ${isItemActive 
                          ? 'ring-2 ring-blue-400 scale-105 bg-blue-50/60 dark:bg-blue-900/30' 
                          : 'hover:ring-1 hover:ring-blue-300/50'
                        }
                        /* 点击状态 */
                        ${isClicked 
                          ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-red-400 scale-95' 
                          : ''
                        }
                      `}
                    >
                      <item.icon className={`h-4 w-4 transition-colors ${
                        isClicked ? 'text-red-500' : ''
                      }`} />
                      <span className={`transition-colors ${
                        isClicked ? 'text-red-500 font-semibold' : ''
                      }`}>
                        {item.label}
                      </span>
                    </Link>
                    
                    {/* 悬停提示 */}
                    <div className='
                      absolute -top-10 left-1/2 transform -translate-x-1/2
                      px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs
                      rounded-md whitespace-nowrap
                      opacity-0 group-hover:opacity-100 pointer-events-none
                      transition-all duration-300 ease-out
                      group-hover:-translate-y-1
                      shadow-lg
                      z-50
                    '>
                      {item.tooltip}
                      {/* 提示框小箭头 */}
                      <div className='
                        absolute -bottom-1 left-1/2 transform -translate-x-1/2
                        w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45
                      ' />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Theme + User */}
            <div className='flex items-center gap-2'>
              <div className='relative group'>
                <div 
                  onClick={() => handleClick('theme')}
                  className='
                    p-2 rounded-full transition-all duration-300
                    hover:bg-blue-50/80 dark:hover:bg-blue-900/20
                    hover:scale-105 active:scale-95
                    cursor-pointer
                  '
                >
                  <ThemeToggle />
                </div>
                <div className='
                  absolute -top-10 left-1/2 transform -translate-x-1/2
                  px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs
                  rounded-md whitespace-nowrap
                  opacity-0 group-hover:opacity-100 pointer-events-none
                  transition-all duration-300 ease-out
                  group-hover:-translate-y-1
                  shadow-lg
                  z-50
                '>
                  切换主题
                  <div className='
                    absolute -bottom-1 left-1/2 transform -translate-x-1/2
                    w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45
                  ' />
                </div>
              </div>
              <div className='relative group'>
                <div 
                  onClick={() => handleClick('user')}
                  className='
                    p-2 rounded-full transition-all duration-300
                    hover:bg-blue-50/80 dark:hover:bg-blue-900/20
                    hover:scale-105 active:scale-95
                    cursor-pointer
                  '
                >
                  <UserMenu />
                </div>
                <div className='
                  absolute -top-10 left-1/2 transform -translate-x-1/2
                  px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs
                  rounded-md whitespace-nowrap
                  opacity-0 group-hover:opacity-100 pointer-events-none
                  transition-all duration-300 ease-out
                  group-hover:-translate-y-1
                  shadow-lg
                  z-50
                '>
                  用户菜单
                  <div className='
                    absolute -bottom-1 left-1/2 transform -translate-x-1/2
                    w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45
                  ' />
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
