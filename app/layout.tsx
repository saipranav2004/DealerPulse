import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const plexSans = localFont({
  variable: '--font-plex-sans',
  display: 'swap',
  src: [
    { path: './fonts/IBMPlexSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexSans-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexSans-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
});

const plexMono = localFont({
  variable: '--font-plex-mono',
  display: 'swap',
  src: [
    { path: './fonts/IBMPlexMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexMono-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexMono-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
});

export const metadata: Metadata = {
  title: 'DealerPulse',
  description: 'Sales performance for a five-branch Toyota dealership group',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Applies the saved theme before first paint so the page never flashes
          the wrong one. Runs synchronously and fails silently if storage is
          blocked, in which case the system preference applies.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=localStorage.getItem('dealerpulse.theme');if(m==='light'||m==='dark'){document.documentElement.setAttribute('data-theme',m)}}catch(e){}",
          }}
        />
        {/*
          Closes any other open menu when one is opened, and closes the open
          menu on Escape or on a click outside it.

          `<details name>` already does the first of these in current browsers;
          this covers the rest and the browsers that do not. It is a listener on
          the document rather than a component, so the filter system stays
          server-rendered and keeps working with JavaScript disabled — the only
          thing lost without it is that two menus can be open at once.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function all(){return document.querySelectorAll('[data-filter-menu][open]')}" +
              "document.addEventListener('toggle',function(e){var t=e.target;" +
              "if(!(t instanceof HTMLDetailsElement)||!t.open||!t.hasAttribute('data-filter-menu'))return;" +
              "all().forEach(function(d){if(d!==t)d.open=false})},true);" +
              "document.addEventListener('keydown',function(e){if(e.key==='Escape')all().forEach(function(d){d.open=false})});" +
              "document.addEventListener('click',function(e){all().forEach(function(d){if(!d.contains(e.target))d.open=false})});})()",
          }}
        />
      </head>
      <body>
        <a href="#main" className="sr-only">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
