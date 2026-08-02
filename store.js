// Store links that survive in-app browsers.
//
// Instagram/Facebook/TikTok webviews load https://play.google.com and
// https://apps.apple.com as ordinary web pages instead of handing them to the
// store apps. The native schemes are the documented escape hatch: a webview
// passes an unknown scheme to the OS.
//
// The markup always carries the plain https URL, so the page works with JS off
// and crawlers see a normal link. This only upgrades the click.
//
// Usage: <a data-store="ios"> / <a data-store="android"> / <p data-inapp-hint hidden>
(function () {
  var ua = navigator.userAgent || '';
  var IOS = /iPhone|iPad|iPod/i.test(ua);
  var ANDROID = /Android/i.test(ua);
  var IN_APP = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Line\/|Snapchat/i.test(ua);

  var APPLE_ID = '6760585986';
  var PKG = 'com.kaithomasdev.hiddenbites';
  var WEB_ANDROID = 'https://play.google.com/store/apps/details?id=' + PKG;
  var WEB_IOS = 'https://apps.apple.com/app/hiddenbites-find-local-gems/id' + APPLE_ID;

  // Android resolves this itself and uses browser_fallback_url when the Play
  // Store app is missing, so no JS timer is needed here.
  var INTENT_ANDROID = 'intent://details?id=' + PKG +
    '#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=' +
    encodeURIComponent(WEB_ANDROID) + ';end';
  var ITMS_IOS = 'itms-apps://apps.apple.com/app/id' + APPLE_ID;

  function each(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }

  if (ANDROID) {
    each('[data-store="android"]', function (a) { a.href = INTENT_ANDROID; });
  }

  if (IOS) {
    each('[data-store="ios"]', function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var left = false;
        function onHide() { if (document.hidden) left = true; }
        document.addEventListener('visibilitychange', onHide);
        window.location.href = ITMS_IOS;
        // Still here after a moment means the scheme was refused.
        setTimeout(function () {
          document.removeEventListener('visibilitychange', onHide);
          if (!left && !document.hidden) window.location.href = WEB_IOS;
        }, 1500);
      });
    });
  }

  // Even with the schemes, some in-app browsers refuse the hand-off. Give
  // people the way out rather than leaving them on a dead button.
  if (IN_APP) {
    each('[data-inapp-hint]', function (el) {
      el.textContent = IOS
        ? 'Button not working? Instagram blocks the App Store here. Tap ••• at the top right, then "Open in external browser".'
        : 'Button not working? Instagram blocks the Play Store here. Tap the menu at the top right, then "Open in browser".';
      el.hidden = false;
    });
  }

  // Put the visitor's own store first.
  var wrap = document.getElementById('stores');
  if (wrap) {
    var ios = wrap.querySelector('[data-store="ios"]');
    var android = wrap.querySelector('[data-store="android"]');
    if (ios && android) {
      if (ANDROID) { wrap.insertBefore(android, ios); ios.classList.add('secondary'); }
      else if (IOS) { android.classList.add('secondary'); }
    }
  }
})();
