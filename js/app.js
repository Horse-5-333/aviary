

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Logic
  const mobileNav = document.querySelector('.mobile-nav');
  const horizontalContainer = document.getElementById('horizontal-scroll-container');
  const hamburgerBtn = document.getElementById('hamburger-menu');
  const navMenuList = document.getElementById('nav-menu-list');

  // Find all sections that should be tracked
  const headers = Array.from(document.querySelectorAll('.general-header'));
  const sections = headers.map((header, index) => {
    // Add ID if missing for scrolling
    if (!header.id) {
      header.id = `section-${index}`;
    }
    return {
      element: header,
      title: header.outerText.trim()
    };
  });

  // Create Horizontal Menu Items
  sections.forEach((section, index) => {
    const item = document.createElement('div');
    item.classList.add('horizontal-item');
    item.textContent = section.title;
    item.dataset.index = index;

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      handleManualScroll(index);
    });
    horizontalContainer.appendChild(item);
  });

  // Create Vertical Menu Items (for expanded state)
  sections.forEach((section, index) => {
    const item = document.createElement('div');
    item.classList.add('nav-menu-item');
    item.textContent = section.title;
    item.addEventListener('click', () => {
      handleManualScroll(index);
      toggleMenu(false);
    });
    navMenuList.appendChild(item);
  });

  let currentIndex = -1; // Force update on first run
  const horizontalItems = Array.from(horizontalContainer.children);
  let isManualScrolling = false;
  let scrollTimeout;

  function updateNav(index) {
    if (currentIndex === index) return;

    // Deactivate old
    if (currentIndex !== -1 && horizontalItems[currentIndex]) {
      horizontalItems[currentIndex].classList.remove('active');
    }

    currentIndex = index;
    const activeItem = horizontalItems[index];

    if (activeItem) {
      activeItem.classList.add('active');

      // Center item logic
      const containerWidth = horizontalContainer.offsetWidth;
      const itemLeft = activeItem.offsetLeft;
      const itemWidth = activeItem.offsetWidth;

      // Account for any padding on the container if necessary, 
      // though offsetLeft is relative to offsetParent (the container usually).
      // Since we added generous padding, we need to be careful.
      // offsetLeft includes the padding-left of the parent if positioning allows, 
      // but typically scrolling 0 puts the first item at the start of visual area.

      // Simple centering:
      const scrollLeft = itemLeft - (containerWidth / 2) + (itemWidth / 2);

      horizontalContainer.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    }
  }

  function handleManualScroll(index) {
    // 1. "Lead" the scroll: Update UI immediately
    updateNav(index);

    // 2. Set flag to ignore scroll events temporarily
    isManualScrolling = true;
    clearTimeout(scrollTimeout);

    // 3. Scroll to section
    if (index >= 0 && index < sections.length) {
      const target = sections[index].element;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 4. Reset flag after estimation of scroll duration
    // Since 'scrollend' isn't universally supported yet, use a generous timeout
    scrollTimeout = setTimeout(() => {
      isManualScrolling = false;
      // One final check in case we ended up somewhere else
      onScroll();
    }, 1000);
  }

  function onScroll() {
    if (isManualScrolling) return;

    // Improved detection: Find element closest to 20% down the viewport
    const detectOffset = window.innerHeight * 0.2;
    let closestIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < sections.length; i++) {
      const rect = sections[i].element.getBoundingClientRect();

      // distance from our target line
      // usage of simple rect.top (signed distance) vs abs distance:
      // We generally want the header that is just above or slightly below the line.
      // Let's rely on absolute distance to the line to find the "active" context.

      const diff = Math.abs(rect.top - detectOffset);

      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }

      // Optimization: If we've passed the point where they are getting further away, stop?
      // Not safe if some sections are huge and some small.
      // But usually they appear in order.
    }

    // Standard "Spy" logic often prefers the LAST item that is ABOVE the line.
    // Let's try that as it handles long sections correctly.
    let currentBest = 0;
    for (let i = 0; i < sections.length; i++) {
      const rect = sections[i].element.getBoundingClientRect();
      if (rect.top <= detectOffset) {
        currentBest = i;
      } else {
        break; // Passed the line
      }
    }

    updateNav(currentBest);
  }

  // Throttled scroll listener
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  });

  function toggleMenu(forceState) {
    if (typeof forceState === 'boolean') {
      if (forceState) mobileNav.classList.add('expanded');
      else mobileNav.classList.remove('expanded');
    } else {
      mobileNav.classList.toggle('expanded');
    }
  }

  hamburgerBtn.addEventListener('click', () => {
    toggleMenu();
  });

  // Initialize
  onScroll();
});
