/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Cat, Clover, Film, Home, Menu, Radio, Search, Tv, X } from 'lucide-react';

import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export default function TopNavbar() {
  const { siteName: _siteName } = useSite(); // 重命名为_siteName以符合ESLint规则
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isActive = (href: string) => {
    return pathname === href;
  };

  const isDoubanActive = (type: string) => {
    const currentType = searchParams.get('type');
    return pathname.startsWith('/douban') && currentType === type;
  };

  return (
    <header className='fixed top-0 left-0 right-0 z-[900] m-0 p-0 overflow-hidden w-full'>
        <nav className='flex items-center justify-between h-14 px-4 w-full m-0 p-0 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/95 backdrop-blur-md shadow-sm shadow-black/5 dark:shadow-black/20'>
            {/* Left: Logo */}
            <div className='flex items-center gap-2 min-w-0'>
              <Link
                href='/'
                className='shrink-0 select-none hover:opacity-90 transition-opacity'
              >
                <span className='text-xl sm:text-2xl font-cursive-custom tracking-tight text-[rgb(59,130,246)] dark:text-[rgb(59,130,246)] drop-shadow-sm'>
                    暴风影视
                  </span>
              </Link>
            </div>

            {/* Center: Controls (hidden on mobile, shown in mobile menu) */}
            <div className='hidden md:flex items-center justify-center gap-1 sm:gap-1 md:gap-2 flex-wrap overflow-x-auto whitespace-nowrap max-w-[70%] flex-1'>
              <Link
                  href='/'
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 md:px-3 md:py-1.5 text-xs sm:text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isActive('/') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <Home className='h-4 w-4' />
                  <span className='hidden md:inline'>首页</span>
                </Link>
                <Link
                  href='/search'
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 md:px-3 md:py-1.5 text-xs sm:text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isActive('/search') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <Search className='h-4 w-4' />
                  <span className='hidden md:inline'>搜索</span>
                </Link>

                {/* Categories */}
                <Link
                  href='/douban?type=movie'
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 md:px-3 md:py-1.5 text-xs sm:text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isDoubanActive('movie') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <Film className='h-4 w-4' />
                  <span className='hidden lg:inline'>电影</span>
                </Link>
                <Link
                  href='/douban?type=tv'
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 md:px-3 md:py-1.5 text-xs sm:text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isDoubanActive('tv') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <Tv className='h-4 w-4' />
                  <span className='hidden lg:inline'>剧集</span>
                </Link>
                <Link
                  href='/douban?type=anime'
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 md:px-3 md:py-1.5 text-xs sm:text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isDoubanActive('anime') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <Cat className='h-4 w-4' />
                  <span className='hidden lg:inline'>动漫</span>
                </Link>
                <Link
                  href='/douban?type=show'
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 md:px-3 md:py-1.5 text-xs sm:text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isDoubanActive('show') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <Clover className='h-4 w-4' />
                  <span className='hidden lg:inline'>综艺</span>
                </Link>
                <Link
                  href='/live'
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 md:px-3 md:py-1.5 text-xs sm:text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isActive('/live') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <Radio className='h-4 w-4' />
                  <span className='hidden lg:inline'>直播</span>
                </Link>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <div className='md:hidden absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm py-2 px-4 z-10'>
                <div className='flex flex-col gap-1'>
                  <Link
                    href='/'
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isActive('/') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Home className='h-4 w-4' />
                    <span>首页</span>
                  </Link>
                  <Link
                    href='/search'
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isActive('/search') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Search className='h-4 w-4' />
                    <span>搜索</span>
                  </Link>
                  <Link
                    href='/douban?type=movie'
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isDoubanActive('movie') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Film className='h-4 w-4' />
                    <span>电影</span>
                  </Link>
                  <Link
                    href='/douban?type=tv'
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isDoubanActive('tv') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Tv className='h-4 w-4' />
                    <span>剧集</span>
                  </Link>
                  <Link
                    href='/douban?type=anime'
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isDoubanActive('anime') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Cat className='h-4 w-4' />
                    <span>动漫</span>
                  </Link>
                  <Link
                    href='/douban?type=show'
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isDoubanActive('show') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Clover className='h-4 w-4' />
                    <span>综艺</span>
                  </Link>
                  <Link
                    href='/live'
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${isActive('/live') ? 'bg-[rgb(59,130,246)] text-white shadow-sm' : 'text-gray-700 dark:text-gray-200'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Radio className='h-4 w-4' />
                    <span>直播</span>
                  </Link>
                  <div className='flex items-center gap-2 py-2 mt-2 border-t border-gray-100 dark:border-gray-800'>
                    <ThemeToggle />
                    <UserMenu />
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Menu Button (only on small screens) */}
            <button 
              className='md:hidden flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800' 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className='h-5 w-5 text-gray-700 dark:text-gray-200' /> : <Menu className='h-5 w-5 text-gray-700 dark:text-gray-200' />}
            </button>

            {/* Right: Theme + User (hidden on mobile) */}
            <div className='hidden md:flex items-center gap-2'>
              <ThemeToggle />
              <UserMenu />
            </div>
        </nav>
    </header>
  );
}
