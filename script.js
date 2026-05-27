function toggleAccordion(trigger) {
  var item = trigger.closest('.accordion-item');
  var isOpen = item.classList.contains('open');
  item.classList.toggle('open', !isOpen);
}
