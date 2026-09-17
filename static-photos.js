/*
 * Fills the site's <image-slot> placeholders with static photo files.
 * This site was originally built with Claude's live design editor, where
 * photos are uploaded into named slots and served from Claude's own
 * servers. That upload/storage system does not exist on GitHub Pages
 * (a static host), so without this script every slot shows its empty
 * placeholder. This script sets each slot's image directly from the
 * /images folder in this repo instead.
 *
 * To change a photo: replace the file in /images (keep the same
 * filename) or update the path below, then commit + push.
 * To add a photo to an empty slot (e.g. "Canoeing", "Wildflowers"):
 * add a line below with the slot id and image path.
 */
(function () {
  var IMAGES = {
    'ila-hero': 'images/hero.jpg',
    'ila-hood': 'images/hood.jpg',
    'ila-members': 'images/members.jpg',
    'ila-contact': 'images/contact.jpg',
    'ila-album-1': 'images/album-morning-mist.jpg',
    // 'ila-album-2': 'images/album-canoeing.jpg',   // Canoeing - no photo yet
    'ila-album-3': 'images/album-sun-on-water.jpg',
    'ila-album-4': 'images/album-the-ridge.jpg',
    'ila-album-5': 'images/album-wildlife.jpg',
    'ila-album-6': 'images/album-fall-colours.jpg',
    // 'ila-album-7': 'images/album-wildflowers.jpg', // Wildflowers - no photo yet
    'ila-album-8': 'images/album-winter-skating.jpg'
  };

  var FORCE_VISIBLE_STYLE =
    // The component normally sizes/positions this img with an inline
    // width/height percentage + left/top 50% + a translate(-50%,-50%)
    // transform (an oversized, centered "manual cover" trick, driven by
    // its own pan/zoom state). That math assumes a real ingested image
    // and comes out wrong for one we set directly - e.g. it can compute
    // no oversize at all, in which case the centering transform shifts
    // the image completely out of the visible frame. Rather than rely
    // on that per-slot arithmetic, override every positioning property
    // to a plain absolute-fill-and-cover: it always fills the frame,
    // regardless of what the component's own state comes out to.
    '.frame > img {' +
    '  display: block !important;' +
    '  position: absolute !important;' +
    '  top: 0 !important;' +
    '  left: 0 !important;' +
    '  width: 100% !important;' +
    '  height: 100% !important;' +
    '  transform: none !important;' +
    '  object-fit: cover !important;' +
    '  object-position: center !important;' +
    '}' +
    '.frame > .empty, .frame > .attr-error { display: none !important; }';

  function applySlot(el) {
    if (!el || el.tagName !== 'IMAGE-SLOT') return;
    var path = IMAGES[el.id];
    if (!path) return;
    var root = el.shadowRoot;
    if (!root) return;
    var img = root.querySelector('.frame > img');
    if (!img) return;
    var url = new URL(path, document.baseURI).href;
    if (img.src !== url) img.src = url;
    // The component re-renders on its own (resize, slide changes, etc.)
    // and resets inline display styles when it thinks a slot is still
    // empty. Toggling inline styles loses that fight intermittently, so
    // force visibility permanently with a !important stylesheet scoped
    // to this slot's shadow root instead - it wins regardless of how
    // many times the component re-renders.
    if (!root.__staticPhotoStyleInjected) {
      var style = document.createElement('style');
      style.textContent = FORCE_VISIBLE_STYLE;
      root.appendChild(style);
      root.__staticPhotoStyleInjected = true;
    }
  }

  function applyAll(scope) {
    (scope || document).querySelectorAll('image-slot').forEach(applySlot);
  }

  function schedule(el) {
    applySlot(el);
    requestAnimationFrame(function () { applySlot(el); });
    setTimeout(function () { applySlot(el); }, 150);
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === 'attributes' && m.target && m.target.tagName === 'IMAGE-SLOT') {
        schedule(m.target);
      }
      if (m.addedNodes) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'IMAGE-SLOT') schedule(n);
          if (n.querySelectorAll) n.querySelectorAll('image-slot').forEach(schedule);
        });
      }
    }
  });

  function start() {
    applyAll();
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['id']
    });
    // Safety net: the component can re-render on its own (e.g. on resize)
    // without any DOM mutation we'd otherwise catch. This is a cheap,
    // idempotent no-op unless something actually drifted.
    setInterval(applyAll, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
