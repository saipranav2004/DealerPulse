import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { BUILD_SHA, DATA_CURRENT_AS_OF } from '@/lib/build-info';
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
        {/*
          The funnel reveal, gated.

          The bars grow from zero on first sight of the funnel — the race between
          the branch's bar and the pale peer bar is the argument the page makes.
          Replaying it on every navigation turns that argument into decoration,
          so it runs once per session and only once the funnel is actually on
          screen. Without this script, or with the flag already set, the bars
          simply render at full size: the animation is opt-in, so the readable
          state is the one that needs no JavaScript.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var K='dp-funnel-shown';var seen=new WeakSet();" +
              "function done(){try{return !!sessionStorage.getItem(K)}catch(e){return true}}" +
              "function watch(el){if(seen.has(el))return;seen.add(el);" +
              "if(!('IntersectionObserver' in window)){return}" +
              "var io=new IntersectionObserver(function(es){es.forEach(function(e){" +
              "if(!e.isIntersecting)return;io.disconnect();" +
              "try{sessionStorage.setItem(K,'1')}catch(x){}" +
              "e.target.setAttribute('data-funnel','run')})},{threshold:0.35});io.observe(el)}" +
              "function scan(){if(done())return;" +
              "document.querySelectorAll('[data-funnel=\"idle\"]').forEach(watch)}" +
              "if(document.readyState!=='loading')scan();" +
              "else document.addEventListener('DOMContentLoaded',scan);" +
              // App Router swaps the tree on soft navigation, so re-scan for a
              // funnel that arrives without a full page load.
              "new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});})()",
          }}
        />
        {/*
          FLIP for the filter chips.

          Removing a chip is a navigation — the server re-renders the bar with
          one fewer chip — so the survivors jump to their new positions between
          two paints. This records each chip's box before the navigation, and
          when the new bar arrives, applies the inverse offset and releases it,
          so a chip slides from where it was to where it now is. Purely
          cosmetic: with the script absent the chips simply appear in place.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var prev={};var pending=false;" +
              "function boxes(){var m={};document.querySelectorAll('[data-flip=\"chips\"] [data-flip-key]')" +
              ".forEach(function(el){m[el.getAttribute('data-flip-key')]=el.getBoundingClientRect()});return m}" +
              "document.addEventListener('click',function(e){" +
              "var a=e.target&&e.target.closest&&e.target.closest('[data-flip=\"chips\"] [data-flip-key]');" +
              "if(!a)return;prev=boxes();pending=true},true);" +
              "function play(){if(!pending)return;pending=false;" +
              "if(matchMedia('(prefers-reduced-motion: reduce)').matches){prev={};return}" +
              "document.querySelectorAll('[data-flip=\"chips\"] [data-flip-key]').forEach(function(el){" +
              "var was=prev[el.getAttribute('data-flip-key')];if(!was)return;" +
              "var now=el.getBoundingClientRect();" +
              "var dx=was.left-now.left,dy=was.top-now.top;" +
              "if(Math.abs(dx)<1&&Math.abs(dy)<1)return;" +
              "el.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}]," +
              "{duration:180,easing:'cubic-bezier(.2,0,0,1)'})});prev={}}" +
              "new MutationObserver(function(){if(pending)requestAnimationFrame(play)})" +
              ".observe(document.documentElement,{childList:true,subtree:true});})()",
          }}
        />
      </head>
      <body>
        <a href="#main" className="sr-only">
          Skip to content
        </a>
        {children}
        {/*
          Which build produced this page, and which data it was built from.
          Two URLs from the same deploy must show the same stamp; when they
          did not, nothing on the page said so.
        */}
        <footer className="appfoot">
          <span className="num">build {BUILD_SHA}</span>
          <span aria-hidden="true">·</span>
          <span className="num">data {DATA_CURRENT_AS_OF}</span>
          <span aria-hidden="true">·</span>
          <a href="/method">How every figure is calculated</a>
        </footer>
      </body>
    </html>
  );
}
