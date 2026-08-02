// Store links that survive in-app browsers.
//
// Instagram's webview refuses both the https store URLs and the native
// schemes (intent:// / itms-apps://), so a tap can silently do nothing.
// There is no API to open the system browser from a webview - on iOS none
// has existed since Apple closed x-safari-https. So the only honest fix is:
// try the native scheme, and when the tap visibly fails, say so and give
// people a way out (copy the link, or an explicit Chrome intent on Android).
//
// The markup always carries the plain https URL, so the page works with JS
// off, crawlers see a normal link, and desktop is untouched.
//
// Usage: <a data-store="ios"> / <a data-store="android"> / <p data-inapp-hint hidden>
(function () {
  var ua = navigator.userAgent || '';
  var IOS = /iPhone|iPad|iPod/i.test(ua);
  var ANDROID = /Android/i.test(ua);
  var IN_APP = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Line\/|Snapchat|Pinterest|Twitter/i.test(ua);

  var APPLE_ID = '6760585986';
  var PKG = 'com.kaithomasdev.hiddenbites';
  var WEB_ANDROID = 'https://play.google.com/store/apps/details?id=' + PKG;
  var INTENT_ANDROID = 'intent://details?id=' + PKG +
    '#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=' +
    encodeURIComponent(WEB_ANDROID) + ';end';
  var ITMS_IOS = 'itms-apps://apps.apple.com/app/id' + APPLE_ID;
  // Forces the page open in Chrome, which can then reach the Play Store.
  var CHROME_INTENT = 'intent://' + location.host + location.pathname +
    '#Intent;scheme=https;package=com.android.chrome;end';

  function each(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }

  // ── Escape panel, shown only once a tap has actually failed ──────────
  var panel;
  function buildPanel() {
    var css = document.createElement('style');
    css.textContent =
      '.hb-esc{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;' +
      'justify-content:center;padding:24px;background:rgba(25,21,18,.55)}' +
      '.hb-esc-card{max-width:360px;width:100%;background:var(--card,#FFFDF8);' +
      'border:1.5px solid var(--border,#F0E4D2);border-radius:18px;padding:26px 22px;text-align:center}' +
      '.hb-esc-card h2{font-family:var(--serif,Georgia,serif);font-size:22px;font-weight:900;' +
      'line-height:1.15;margin:0 0 10px;color:var(--ink,#191512)}' +
      '.hb-esc-card p{font-size:14px;line-height:1.6;color:var(--warmgray,#A79E90);margin:0 0 18px}' +
      '.hb-esc-card b{color:var(--ink,#191512)}' +
      '.hb-esc-btn{display:block;width:100%;background:var(--ink,#191512);color:var(--card,#FFFDF8);' +
      'border:1.5px solid var(--ink,#191512);border-radius:14px;padding:14px 18px;font:800 14.5px/1 inherit;' +
      'font-family:inherit;text-decoration:none;cursor:pointer;margin-bottom:9px}' +
      '.hb-esc-close{background:none;border:0;color:var(--warmgray,#A79E90);font:600 13px/1 inherit;' +
      'font-family:inherit;cursor:pointer;padding:8px;margin-top:4px}';
    document.head.appendChild(css);

    panel = document.createElement('div');
    panel.className = 'hb-esc';
    panel.hidden = true;
    var menu = IOS ? '•••' : 'the ⋮ menu';
    var where = IOS ? 'Open in external browser' : 'Open in browser';
    panel.innerHTML =
      '<div class="hb-esc-card" role="dialog" aria-modal="true">' +
      '<h2>Instagram is blocking the store</h2>' +
      '<p>Its built-in browser won\'t hand the link over. Tap <b>' + menu + '</b> at the top ' +
      'right of this screen and choose <b>"' + where + '"</b> - the button works there.</p>' +
      (ANDROID ? '<a class="hb-esc-btn" href="' + CHROME_INTENT + '">Open in Chrome</a>' : '') +
      '<button class="hb-esc-btn" data-copy>Copy link instead</button>' +
      '<button class="hb-esc-close" data-close>Back</button>' +
      '</div>';
    document.body.appendChild(panel);

    panel.querySelector('[data-close]').addEventListener('click', function () { panel.hidden = true; });
    panel.querySelector('[data-copy]').addEventListener('click', function () {
      var url = location.href.split('#')[0];
      var btn = this;
      function done() { btn.textContent = 'Link copied ✓'; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, legacyCopy);
      } else { legacyCopy(); }
      function legacyCopy() {
        var i = document.createElement('input');
        i.value = url;
        document.body.appendChild(i);
        i.select();
        try { document.execCommand('copy'); done(); } catch (err) { btn.textContent = url; }
        i.remove();
      }
    });
  }

  function showPanel() {
    if (!panel) buildPanel();
    panel.hidden = false;
  }

  // ── Store taps ───────────────────────────────────────────────────────
  each('[data-store]', function (a) {
    var web = a.href;
    var native = a.dataset.store === 'ios' ? ITMS_IOS : INTENT_ANDROID;
    if (!IOS && !ANDROID) return;             // desktop: plain link is right
    if (ANDROID) a.href = INTENT_ANDROID;     // works outside in-app browsers

    a.addEventListener('click', function (e) {
      e.preventDefault();
      // Two signals that the store app actually took over: the page got
      // backgrounded, or the timer drifted because we were frozen. Checking
      // document.hidden at fire time alone is unreliable - an unfocused tab
      // reports hidden without anything having happened.
      var t0 = Date.now();
      var gone = false;
      function onHide() { if (document.hidden) gone = true; }
      document.addEventListener('visibilitychange', onHide);
      window.location.href = native;

      setTimeout(function () {
        document.removeEventListener('visibilitychange', onHide);
        if (gone || Date.now() - t0 > 2200) return;
        // In an in-app browser the https URL just loads inside the webview,
        // which is the dead end people reported - explain instead.
        if (IN_APP) { showPanel(); return; }
        window.location.href = web;
      }, 1200);
    });
  });

  // Pre-emptive note so the dead tap is not a surprise.
  if (IN_APP) {
    each('[data-inapp-hint]', function (el) {
      el.textContent = IOS
        ? 'Heads up: Instagram\'s browser blocks the App Store. Tap ••• at the top right → "Open in external browser".'
        : 'Heads up: Instagram\'s browser blocks the Play Store. Tap the menu at the top right → "Open in browser".';
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
