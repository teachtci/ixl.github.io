var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var worker_default = {
  async fetch(request) {
    return handleRequest(request);
  }
};
var AD_PATTERNS = [
  "googlesyndication.com",
  "doubleclick.net",
  "googleadservices.com",
  "google-analytics.com",
  "googletagmanager.com",
  "googletagservices.com",
  "adservice.google.com",
  "pagead2.googlesyndication.com",
  "tpc.googlesyndication.com",
  "video-ad-stats.googlesyndication.com",
  "ads.google.com",
  "adssettings.google.com",
  "static.ads-twitter.com",
  "ads-api.twitter.com",
  "ads.facebook.com",
  "an.facebook.com",
  "adnxs.com",
  "advertising.com",
  "outbrain.com",
  "taboola.com",
  "criteo.com",
  "pubmatic.com",
  "rubiconproject.com",
  "openx.net",
  "adsafeprotected.com",
  "moatads.com",
  "scorecardresearch.com",
  "/ads/",
  "/ad/",
  "/advert/",
  "/advertisement/",
  "/adsense/",
  "/adserver/",
  "/analytics/",
  "prebid",
  "advertis",
  "banner",
  "popup"
];
function isAdRequest(url) {
  const urlLower = url.toLowerCase();
  return AD_PATTERNS.some((pattern) => urlLower.includes(pattern));
}
__name(isAdRequest, "isAdRequest");
async function handleRequest(request) {
  const url = new URL(request.url);
  if (url.pathname === "/" || url.pathname === "") {
    return new Response(getMainHTML(), {
      headers: {
        "Content-Type": "text/html",
        "Permissions-Policy": "accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*"
      }
    });
  }
  if (url.pathname === "/manifest.json") {
    return new Response(getManifest(), {
      headers: { "Content-Type": "application/manifest+json" }
    });
  }
  if (url.pathname === "/sw.js") {
    return new Response(getServiceWorker(), {
      headers: {
        "Content-Type": "application/javascript",
        "Service-Worker-Allowed": "/"
      }
    });
  }
  if (url.pathname === "/favicon.png" || url.pathname === "/icon-192.png" || url.pathname === "/icon-512.png" || url.pathname === "/icon.svg") {
    const iconRes = await fetch("https://edpuzzle.b-cdn.net/assets/favicon-33c8b418.ico");
    const iconHeaders = new Headers(iconRes.headers);
    iconHeaders.set("Content-Type", "image/x-icon");
    iconHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return new Response(iconRes.body, {
      status: iconRes.status,
      headers: iconHeaders
    });
  }
  return proxyCloudMoon(request);
}
__name(handleRequest, "handleRequest");
async function proxyCloudMoon(request) {
  const url = new URL(request.url);
  let targetURL;
  if (url.pathname.startsWith("/proxy/")) {
    const encodedURL = url.pathname.substring("/proxy/".length);
    try {
      targetURL = decodeURIComponent(encodedURL);
      if (url.search) {
        targetURL += url.search;
      }
    } catch (e) {
      console.error("Failed to decode proxy URL:", encodedURL);
      return new Response("Invalid proxy URL", { status: 400 });
    }
  } else {
    targetURL = "https://web.cloudmoonapp.com" + url.pathname + url.search;
  }
  if (isAdRequest(targetURL)) {
    return new Response("", { status: 204 });
  }
  const headers = new Headers(request.headers);
  headers.set("Host", new URL(targetURL).host);
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ray");
  headers.delete("x-forwarded-proto");
  headers.delete("x-real-ip");
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  }
  const proxyRequest = new Request(targetURL, {
    method: request.method,
    headers,
    body: request.body,
    redirect: "follow"
  });
  let response;
  try {
    response = await fetch(proxyRequest);
  } catch (error) {
    return new Response("Failed to fetch resource", { status: 502 });
  }
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Methods", "*");
  newHeaders.set("Access-Control-Allow-Headers", "*");
  newHeaders.set("Access-Control-Allow-Credentials", "true");
  newHeaders.delete("Content-Security-Policy");
  newHeaders.delete("X-Frame-Options");
  newHeaders.delete("Frame-Options");
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("text/html")) {
    let html = await response.text();
    html = blockAdsInHTML(html);
    const injectionCode = `
<style id="cm-ad-blocker-css">
  .a-div-horizontal,
  .a-div-vertical,
  .a-div-placeholder,
  .a-div-box {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    position: absolute !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
  }
</style>
<script id="cm-fix-js">
(function(){
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && isAdUrl(url)) {
      return Promise.reject(new Error('Ad blocked'));
    }
    return originalFetch.apply(this, args);
  };
  
  const originalXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url) {
    if (isAdUrl(url)) {
      return;
    }
    return originalXHR.apply(this, arguments);
  };
  
  function isAdUrl(url) {
    const adPatterns = [
      'googlesyndication', 'doubleclick', 'googleadservices',
      'google-analytics', 'googletagmanager', 'googletagservices',
      '/ads/', '/ad/', '/advert', 'adsense', 'analytics',
      'facebook.com/ads', 'twitter.com/ads'
    ];
    return adPatterns.some(pattern => url.toLowerCase().includes(pattern));
  }
  
  function removeAds() {
    const googleAdSelectors = [
      'iframe[src*="googlesyndication"]',
      'iframe[src*="doubleclick"]',
      'iframe[src*="google-analytics"]',
      'div[id*="google_ads"]',
      'div[class*="adsbygoogle"]',
      'ins.adsbygoogle',
      '[data-ad-slot]',
      '[data-ad-client]'
    ];
    
    googleAdSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = 'none';
        try { el.remove(); } catch (e) {}
      });
    });
    
    const adDivs = document.querySelectorAll('.a-div-horizontal, .a-div-vertical, .a-div-placeholder, .a-div-box');
    adDivs.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.position = 'absolute';
      el.style.width = '0';
      el.style.height = '0';
      el.style.overflow = 'hidden';
      try { el.remove(); } catch (e) {}
    });
  }

  // Enhanced cleaner to completely remove dynamically-injected description elements and long SEO blocks
  function removeCloudMoonText() {
    // Target any element containing long SEO descriptions about CloudMoon platform
    const allElements = document.querySelectorAll('div, p, span, section');
    allElements.forEach(el => {
      // Check if text content contains signature phrases from that intro block
      if (el.textContent && (
          el.textContent.includes("CloudMoon is a free cloud gaming platform") ||
          el.textContent.includes("offers over 300 popular games") ||
          el.textContent.includes("low-spec phones can smoothly run games")
      )) {
        // Find the outermost wrapping block container to remove cleanly without breaking app UI
        let target = el;
        while (target.parentNode && target.parentNode !== document.body && target.parentNode.nodeName !== 'MAIN') {
          if (target.parentNode.querySelectorAll('canvas, iframe, video').length > 0) break;
          target = target.parentNode;
        }
        target.style.setProperty('display', 'none', 'important');
        target.style.setProperty('visibility', 'hidden', 'important');
        try { target.remove(); } catch(e) {}
      }
    });
  }
  
  function fixButtons() { 
    var allBtns = document.querySelectorAll("button.google-button, button.apple-button");
    for (var i = 0; i < allBtns.length; i++) {
      var btn = allBtns[i];
      var styleAttr = btn.getAttribute("style") || "";
      
      if (styleAttr.indexOf("123, 108, 196") !== -1 || styleAttr.indexOf("123,108,196") !== -1) {
        btn.style.setProperty("display", "flex", "important");
        btn.style.setProperty("visibility", "visible", "important");
        btn.style.setProperty("opacity", "1", "important");
        btn.style.setProperty("pointer-events", "auto", "important");
        btn.style.setProperty("flex-direction", "row", "important");
        btn.style.setProperty("justify-content", "center", "important");
        btn.style.setProperty("align-items", "center", "important");
        btn.style.setProperty("gap", "1rem", "important");
        btn.style.setProperty("width", "min(350px, 100%)", "important");
        btn.style.setProperty("height", "45px", "important");
        btn.style.setProperty("border-radius", "5rem", "important");
        btn.style.setProperty("cursor", "pointer", "important");
        btn.style.setProperty("font-size", "1rem", "important");
      }
      else if (styleAttr.indexOf("255, 255, 255") !== -1 || styleAttr.indexOf("#fff") !== -1 || styleAttr.indexOf("white") !== -1 || btn.querySelector("svg")) {
        btn.style.setProperty("display", "none", "important");
        btn.style.setProperty("visibility", "hidden", "important");
      }
    }
  }
  
  removeAds();
  removeCloudMoonText();
  fixButtons();
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      fixButtons();
      removeAds();
      removeCloudMoonText();
    });
  }
  
  window.addEventListener("load", function() {
    fixButtons();
    removeAds();
    removeCloudMoonText();
  });
  
  setInterval(function() {
    fixButtons();
    removeAds();
    removeCloudMoonText();
  }, 50);
  
  var observer = new MutationObserver(function() {
    fixButtons();
    removeAds();
    removeCloudMoonText();
  });
  
  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
    } else {
      setTimeout(startObserver, 10);
    }
  }
  startObserver();

  var origOpen = window.open;
  var workerOrigin = window.location.origin;

  function sendGameUrl(url) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({type: "LOAD_GAME", url: url}, workerOrigin);
    }
  }

  function makeFakeWindow() {
    var locObj = { _href: 'about:blank' };
    Object.defineProperty(locObj, 'href', {
      get: function() { return this._href; },
      set: function(url) {
        this._href = url;
        if (typeof url === 'string' && url.indexOf('/run-site/') > -1) { sendGameUrl(url); }
      }
    });
    locObj.assign = function(url) { locObj.href = url; };
    locObj.replace = function(url) { locObj.href = url; };
    return {
      closed: false,
      close: function(){}, focus: function(){}, blur: function(){},
      location: locObj,
      document: { write: function(){}, close: function(){}, open: function(){} }
    };
  }

  window.open = function(u, t, f) {
    if (u && u.indexOf('/run-site/') > -1) {
      sendGameUrl(u);
      return makeFakeWindow();
    }
    if (!u || u === '' || u === 'about:blank') {
      return makeFakeWindow();
    }
    return origOpen.call(this, u, t, f);
  };

  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (a && a.href && a.href.indexOf('/run-site/') > -1) {
      e.preventDefault();
      e.stopImmediatePropagation();
      sendGameUrl(a.href);
    }
  }, true);
  
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'REQUEST_FULLSCREEN') {
      var gameWrapper = document.querySelector('#gameWrapper');
      if (gameWrapper) {
        var inputDiv = document.querySelector('#input-div');
        var sidebar = document.querySelector('.sidebar.sidebar-open') || document.querySelector('.sidebar');
        var floatingBall = document.querySelector('#floating-ball');
        
        var elementsToRestore = [];
        
        function storeAndMoveElement(element) {
          if (!element) return;
          var originalParent = element.parentNode;
          var originalNextSibling = element.nextSibling;
          var originalStyle = element.getAttribute('style') || '';
          var computedStyle = window.getComputedStyle(element);
          var originalPosition = {
            position: computedStyle.position,
            top: computedStyle.top,
            left: computedStyle.left,
            right: computedStyle.right,
            bottom: computedStyle.bottom,
            zIndex: computedStyle.zIndex,
            transform: computedStyle.transform
          };
          
          elementsToRestore.push({
            element: element,
            parent: originalParent,
            nextSibling: originalNextSibling,
            styleAttr: originalStyle,
            position: originalPosition
          });
          
          gameWrapper.appendChild(element);
          element.style.position = 'fixed';
          element.style.zIndex = '999999';
          element.style.pointerEvents = 'auto';
          
          if (element.id === 'input-div') {
            element.style.bottom = '20px';
            element.style.left = '0px';
          } else if (element.id === 'floating-ball') {
            element.style.left = '0px';
            element.style.top = '50%';
            element.style.transform = 'translateY(-50%)';
          }
        }
        
        var originalWrapperPosition = gameWrapper.style.position;
        gameWrapper.style.position = 'relative';
        
        storeAndMoveElement(inputDiv);
        storeAndMoveElement(sidebar);
        storeAndMoveElement(floatingBall);
        
        if (gameWrapper.requestFullscreen) {
          gameWrapper.requestFullscreen();
        } else if (gameWrapper.webkitRequestFullscreen) {
          gameWrapper.webkitRequestFullscreen();
        } else if (gameWrapper.mozRequestFullScreen) {
          gameWrapper.mozRequestFullScreen();
        } else if (gameWrapper.msRequestFullscreen) {
          gameWrapper.msRequestFullscreen();
        }
        
        var fullscreenExitHandler = function() {
          if (document.fullscreenElement || document.webkitFullscreenElement || 
              document.mozFullScreenElement || document.msFullscreenElement) {
            return;
          }
          
          elementsToRestore.forEach(function(item) {
            if (item.element && item.parent) {
              if (item.nextSibling && item.nextSibling.parentNode === item.parent) {
                item.parent.insertBefore(item.element, item.nextSibling);
              } else {
                item.parent.appendChild(item.element);
              }
              if (item.styleAttr) {
                item.element.setAttribute('style', item.styleAttr);
              } else {
                item.element.removeAttribute('style');
              }
            }
          });
          
          if (originalWrapperPosition) {
            gameWrapper.style.position = originalWrapperPosition;
          } else {
            gameWrapper.style.position = '';
          }
          
          document.removeEventListener('fullscreenchange', fullscreenExitHandler);
          document.removeEventListener('webkitfullscreenchange', fullscreenExitHandler);
          document.removeEventListener('mozfullscreenchange', fullscreenExitHandler);
          document.removeEventListener('MSFullscreenChange', fullscreenExitHandler);
        };
        
        document.addEventListener('fullscreenchange', fullscreenExitHandler);
        document.addEventListener('webkitfullscreenchange', fullscreenExitHandler);
        document.addEventListener('mozfullscreenchange', fullscreenExitHandler);
        document.addEventListener('MSFullscreenChange', fullscreenExitHandler);
      }
    }
  });
})();
<\/script>`;
    if (html.includes("</head>")) {
      html = html.replace("</head>", injectionCode + "</head>");
    } else {
      html = injectionCode + html;
    }
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  if (contentType.includes("javascript") || contentType.includes("application/x-javascript")) {
    if (isAdRequest(targetURL)) {
      return new Response("// Ad script blocked", {
        status: 200,
        headers: { "Content-Type": "application/javascript" }
      });
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
__name(proxyCloudMoon, "proxyCloudMoon");
function blockAdsInHTML(html) {
  html = html.replace(/<script[^>]*googlesyndication[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<script[^>]*adsbygoogle[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<script[^>]*google-analytics[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<script[^>]*googletagmanager[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<script[^>]*doubleclick[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<iframe[^>]*googlesyndication[^>]*>[\s\S]*?<\/iframe>/gi, "");
  html = html.replace(/<iframe[^>]*doubleclick[^>]*>[\s\S]*?<\/iframe>/gi, "");
  html = html.replace(/<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi, "");
  html = html.replace(/<div[^>]*id="google_ads[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  return html;
}
__name(blockAdsInHTML, "blockAdsInHTML");
function getMainHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edpuzzle Help Center</title>
    <meta name="description" content="">
    
    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#2d2d2d">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Edpuzzle">
    <link rel="manifest" href="/manifest.json?v=4">
    <link rel="apple-touch-icon" href="/favicon.png?v=4">
    
    <link rel="icon" id="favicon" type="image/x-icon" href="/favicon.png?v=4">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            overflow: hidden;
        }
        
        #container {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        #frame-container {
            flex: 1;
            width: 100%;
            height: 100%;
            background: white;
            position: relative;
        }
        
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
            outline: none;
        }
        
        iframe:focus {
            outline: none;
        }

        #btn-dock {
            position: fixed;
            bottom: 18px;
            left: 18px;
            display: flex;
            flex-direction: row;
            gap: 10px;
            z-index: 9999;
            transition: opacity 0.3s;
        }

        #btn-dock.hidden {
            opacity: 0;
            pointer-events: none;
        }

        .dock-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: none;
            background: rgba(45, 45, 45, 0.85);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            color: #e0e0e0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
            transition: background 0.2s, transform 0.15s;
        }

        .dock-btn:hover {
            background: rgba(74, 74, 74, 0.95);
        }

        .dock-btn:active {
            transform: scale(0.93);
        }

        #install-btn {
            display: none;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="frame-container"></div>
    </div>

    <div id="btn-dock">
        <button class="dock-btn" id="home-btn" onclick="goBack()" title="Home">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"/>
            </svg>
        </button>
        <button class="dock-btn" id="fullscreen-btn" onclick="enterFullscreen()" title="Fullscreen">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
            </svg>
        </button>
        <button class="dock-btn" id="install-btn" onclick="installPWA()" title="Install App">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
        </button>
    </div>

    <script>
        const frameContainer = document.getElementById('frame-container');
        const homeBtn = document.getElementById('home-btn');
        const btnDock = document.getElementById('btn-dock');
        
        let isShowingGame = false;
        let mainURL = '/web.cloudmoonapp.com/';
        let shadowRoots = [];
        let currentIframe = null;
        
        const SANDBOX_HOME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const SANDBOX_GAME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const ALLOW_PERMISSIONS = 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad';
        
        const SHADOW_LAYERS = 4;
        
        function createMultiLayerShadowFrame(url, isGame = false) {
            frameContainer.innerHTML = '';
            shadowRoots = [];
            
            let currentHost = document.createElement('div');
            currentHost.style.width = '100%';
            currentHost.style.height = '100%';
            currentHost.style.margin = '0';
            currentHost.style.padding = '0';
            currentHost.style.border = 'none';
            currentHost.style.display = 'block';
            currentHost.style.overflow = 'hidden';
            currentHost.setAttribute('data-id', generateRandomId());
            currentHost.setAttribute('data-component', 'container');
            
            frameContainer.appendChild(currentHost);
            
            for (let i = 0; i < SHADOW_LAYERS; i++) {
                const shadowRoot = currentHost.attachShadow({ mode: 'closed' });
                shadowRoots.push(shadowRoot);
                
                if (i < SHADOW_LAYERS - 1) {
                    const nextHost = document.createElement('div');
                    nextHost.style.width = '100%';
                    nextHost.style.height = '100%';
                    nextHost.style.margin = '0';
                    nextHost.style.padding = '0';
                    nextHost.style.border = 'none';
                    nextHost.style.display = 'block';
                    nextHost.style.overflow = 'hidden';
                    nextHost.setAttribute('data-layer', i.toString());
                    nextHost.setAttribute('data-id', generateRandomId());
                    
                    shadowRoot.appendChild(nextHost);
                    currentHost = nextHost;
                } else {
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.style.margin = '0';
                    iframe.style.padding = '0';
                    iframe.style.display = 'block';
                    iframe.style.overflow = 'hidden';
                    
                    const sandboxAttr = isGame ? SANDBOX_GAME : SANDBOX_HOME;
                    iframe.setAttribute('sandbox', sandboxAttr);
                    iframe.setAttribute('allow', ALLOW_PERMISSIONS);
                    iframe.setAttribute('title', isGame ? 'Game Preview' : 'CloudMoon Preview');
                    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                    iframe.setAttribute('importance', 'high');
                    iframe.setAttribute('loading', 'eager');
                    iframe.setAttribute('data-frame-id', generateRandomId());
                    iframe.setAttribute('data-secure', 'true');
                    
                    iframe.src = url;
                    
                    shadowRoot.appendChild(iframe);
                    currentIframe = iframe;
                    
                    iframe.addEventListener('load', () => {
                        focusIframe();
                    });
                }
            }
        }
        
        function generateRandomId() {
            return 'x' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }
        
        function focusIframe() {
            setTimeout(() => {
                if (currentIframe) {
                    currentIframe.focus();
                    try {
                        currentIframe.contentWindow.focus();
                    } catch (e) {}
                }
            }, 100);
        }
        
        createMultiLayerShadowFrame(mainURL, false);
        
        document.addEventListener('click', (e) => {
            if (currentIframe && e.target !== currentIframe) {
                focusIframe();
            }
        });
        
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) return;
            if (event.data && event.data.type === 'LOAD_GAME') {
                const gameUrl = event.data.url;
                loadGame(gameUrl);
            }
        });
        
        function loadGame(url) {
            let fixedURL = url;
            const workerDomain = window.location.origin;
            
            if (url.includes(workerDomain)) {
                fixedURL = url;
            } else if (url.includes('://')) {
                fixedURL = workerDomain + '/proxy/' + encodeURIComponent(url);
            } else if (url.startsWith('/')) {
                fixedURL = url;
            }
            
            createMultiLayerShadowFrame(fixedURL, true);
            isShowingGame = true;
        }
        
        function goBack() {
            createMultiLayerShadowFrame(mainURL, false);
            isShowingGame = false;

            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }

        function enterFullscreen() {
            if (currentIframe && currentIframe.contentWindow) {
                currentIframe.contentWindow.postMessage({ type: 'REQUEST_FULLSCREEN' }, window.location.origin);
            } else {
                const el = frameContainer;
                if (el.requestFullscreen) el.requestFullscreen();
                else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
                else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
                else if (el.msRequestFullscreen) el.msRequestFullscreen();
            }
        }
        
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
        }
        
        let deferredPrompt;
        const installBtn = document.getElementById('install-btn');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installBtn.style.display = 'flex';
        });

        function installPWA() {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            }).catch(() => {
                deferredPrompt = null;
            });
        }

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            installBtn.style.display = 'none';
        });
    <\/script>
</body>
</html>`;
}
__name(getMainHTML, "getMainHTML");
function getManifest() {
  return JSON.stringify({
    "id": "/?source=pwa",
    "name": "Edpuzzle",
    "short_name": "Edpuzzle",
    "description": "",
    "start_url": "/?source=pwa",
    "scope": "/",
    "display": "standalone",
    "display_override": ["standalone", "minimal-ui"],
    "background_color": "#0d1117",
    "theme_color": "#2d2d2d",
    "orientation": "any",
    "icons": [
      {
        "src": "/icon-192.png?v=4",
        "sizes": "192x192",
        "type": "image/x-icon",
        "purpose": "any"
      },
      {
        "src": "/icon-512.png?v=4",
        "sizes": "512x512",
        "type": "image/x-icon",
        "purpose": "any"
      }
    ],
    "categories": ["education"],
    "prefer_related_applications": false
  });
}
__name(getManifest, "getManifest");
function getServiceWorker() {
  return `// CloudMoon InPlay Service Worker
const CACHE_NAME = 'cloudmoon-v6';
const RUNTIME_CACHE = 'cloudmoon-runtime-v6';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const critical = ['/', '/manifest.json', '/sw.js'];
      const optional = ['/favicon.png', '/icon.svg', '/icon-192.png', '/icon-512.png'];
      await cache.addAll(critical);
      await Promise.allSettled(
        optional.map(url =>
          fetch(url).then(res => {
            if (res && res.status === 200) return cache.put(url, res);
          }).catch(() => {})
        )
      );
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const reqPath = new URL(event.request.url).pathname;
  if (reqPath.startsWith('/run-site/') || reqPath.startsWith('/proxy/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch(() => {});
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('', { 
            status: 200, 
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});`;
}
__name(getServiceWorker, "getServiceWorker");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
