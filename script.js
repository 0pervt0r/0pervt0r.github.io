function toggleAccordion(trigger) {
  var item = trigger.closest('.accordion-item');
  var body = item.querySelector('.accordion-body');
  var isOpen = item.classList.contains('open');

  if (isOpen) {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(function() {
      body.style.maxHeight = '0';
    });
    item.classList.remove('open');
  } else {
    item.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    body.addEventListener('transitionend', function handler() {
      body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', handler);
    });
  }
}

(function() {
  var overlay = document.getElementById('accessOverlay');
  if (!overlay) return;

  var bar = overlay.querySelector('.access-overlay-bar');

  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      bar.style.width = '100%';
    });
  });

  setTimeout(function() {
    overlay.classList.add('hiding');
    setTimeout(function() {
      overlay.remove();
    }, 650);
  }, 5000);
})();
