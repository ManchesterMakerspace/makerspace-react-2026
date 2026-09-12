// Rails shell contract: replace the resolved path before the React bundle mounts.
// Keep aligned with makerspace-rails-2026 app/views/layouts/application.html.erb.
(function () {
  var target = document.querySelector('meta[name="shortcode-target"]').content;
  if (target.charAt(0) === '/' && target.charAt(1) !== '/') {
    window.history.replaceState(window.history.state, '', target);
  }
})();
