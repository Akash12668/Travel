/* ============================================
   ACCORDION FUNCTIONALITY
   ============================================ */
function toggleAccordion(selectedIndex) {
    const items = document.querySelectorAll('.accordion-item');

    items.forEach((item, index) => {
        const content = item.querySelector('.accordion-content');
        const toggleBtn = item.querySelector('.accordion-toggle i');

        if (index === selectedIndex) {
            const isExpanded = content.classList.contains('expanded');
            
            if (isExpanded) {
                content.classList.remove('expanded');
                toggleBtn.className = 'fa-solid fa-plus';
            } else {
                content.classList.add('expanded');
                toggleBtn.className = 'fa-solid fa-minus';
            }
        } else {
            content.classList.remove('expanded');
            if (toggleBtn) {
                toggleBtn.className = 'fa-solid fa-plus';
            }
        }
    });
}

/* ============================================
   MODAL FUNCTIONALITY
   ============================================ */
function openAiModal(groupType = 'Family Adventurers') {
    const modal = document.getElementById('ai-modal');
    const groupSelect = document.getElementById('ai-group-type');
    if (groupSelect) groupSelect.value = groupType;
    
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function closeAiModal() {
    const modal = document.getElementById('ai-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function switchTab(tab) {
    const itineraryTab = document.getElementById('tab-itinerary');
    const imageTab = document.getElementById('tab-image');
    const itineraryBtn = document.getElementById('tab-itinerary-btn');
    const imageBtn = document.getElementById('tab-image-btn');

    if (tab === 'itinerary') {
        itineraryTab.classList.remove('hidden');
        imageTab.classList.add('hidden');
        itineraryBtn.classList.add('active');
        imageBtn.classList.remove('active');
    } else {
        itineraryTab.classList.add('hidden');
        imageTab.classList.remove('hidden');
        imageBtn.classList.add('active');
        itineraryBtn.classList.remove('active');
    }
}

/* ============================================
   GEMINI API INTEGRATIONS
   ============================================ */
let currentBriefingText = "";

async function generateAiItinerary() {
    const groupType = document.getElementById('ai-group-type').value;
    const destination = document.getElementById('ai-destination').value || 'Yosemite National Park';
    
    const outputContainer = document.getElementById('itinerary-output-container');
    const loading = document.getElementById('itinerary-loading');
    const content = document.getElementById('itinerary-content');
    const sourcesDiv = document.getElementById('grounding-sources');
    const sourcesList = document.getElementById('sources-list');
    const ttsBtn = document.getElementById('tts-btn');

    outputContainer.classList.add('show');
    loading.classList.add('show');
    content.innerHTML = "";
    sourcesDiv.classList.remove('show');
    ttsBtn.disabled = true;

    const systemPrompt = "You are an expert outdoor adventure guide. Provide a structured, engaging 2-day outdoor itinerary with packing highlights and campsite recommendations tailored specifically for the selected group type.";
    const userQuery = `Create a customized outdoor trip plan for ${groupType} traveling to ${destination}. Include key highlights, kid/solo/group safety tips, and current seasonal advice. Keep it concise, friendly, and formatted with bold headers and bullet points.`;

    const apiKey = ""; // Runtime automatically provides key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        tools: [{ "google_search": {} }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            currentBriefingText = text.replace(/[*#_]/g, ''); // Clean markdown for TTS

            // Basic formatting text into HTML
            const htmlText = text
                .replace(/\*\*(.?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n\n/g, '<br/><br/>')
                .replace(/^\* /gm, '• ');

            content.innerHTML = htmlText;
            ttsBtn.disabled = false;

            // Handle search grounding sources
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                const sources = groundingMetadata.groundingAttributions
                    .map(attr => ({ uri: attr.web?.uri, title: attr.web?.title }))
                    .filter(src => src.uri && src.title);

                if (sources.length > 0) {
                    sourcesList.innerHTML = sources.slice(0, 4).map(s => 
                        `<a href="${s.uri}" target="_blank" rel="noopener" class="modal-source-link">${s.title}</a>`
                    ).join('');
                    sourcesDiv.classList.add('show');
                }
            }
        } else {
            content.innerHTML = "<p style='color: #ef4444; font-weight: 600;'>Failed to generate itinerary. Please try again.</p>";
        }
    } catch (err) {
        console.error(err);
        content.innerHTML = "<p style='color: #ef4444; font-weight: 600;'>An error occurred connecting to Gemini API.</p>";
    } finally {
        loading.classList.remove('show');
    }
}

/* ============================================
   GEMINI TTS AUDIO INTEGRATION
   ============================================ */
async function speakBriefing() {
    if (!currentBriefingText) return;

    const ttsBtn = document.getElementById('tts-btn');
    ttsBtn.innerHTML = '<i class="fa-solid fa-spinner" style="animation: spin 1s linear infinite;"></i>';
    ttsBtn.disabled = true;

    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

    const shortPrompt = `Summarize and present in a cheerful campfire guide voice: ${currentBriefingText.substring(0, 300)}`;

    const payload = {
        contents: [{ parts: [{ text: shortPrompt }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
            }
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const base64Audio = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType || "audio/L16";

        if (base64Audio) {
            const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || "24000", 10);
            const pcmData = base64ToArrayBuffer(base64Audio);
            const pcm16 = new Int16Array(pcmData);
            const wavBlob = pcmToWav(pcm16, sampleRate);
            const audioUrl = URL.createObjectURL(wavBlob);

            const audio = new Audio(audioUrl);
            audio.play();
            ttsBtn.innerHTML = '<i class="fa-solid fa-volume-high" style="color: var(--brand-600);"></i>';
            ttsBtn.disabled = false;
        } else {
            alert("Audio generation was not available.");
            ttsBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            ttsBtn.disabled = false;
        }
    } catch (e) {
        console.error(e);
        ttsBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        ttsBtn.disabled = false;
    }
}

/* ============================================
   IMAGEN 4 CONCEPT GENERATOR
   ============================================ */
async function generateCampsiteImage() {
    const promptInput = document.getElementById('image-prompt').value || "Cozy aesthetic camping setup with tent and warm campfire at sunset in pine forest";
    const placeholder = document.getElementById('image-placeholder');
    const loading = document.getElementById('image-loading');
    const imgElement = document.getElementById('generated-image');
    const generateBtn = document.getElementById('generate-image-btn');

    placeholder.classList.add('hidden');
    imgElement.classList.remove('show');
    loading.classList.add('show');
    generateBtn.disabled = true;

    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

    const payload = {
        instances: [{ prompt: promptInput }],
        parameters: { sampleCount: 1 }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.predictions && result.predictions[0]?.bytesBase64Encoded) {
            const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
            imgElement.src = imageUrl;
            imgElement.classList.add('show');
        } else {
            placeholder.classList.remove('hidden');
            placeholder.innerHTML = '<p style="color: #ef4444; font-weight: 600; font-size: 0.75rem;">Could not generate image. Please try again.</p>';
        }
    } catch (err) {
        console.error(err);
        placeholder.classList.remove('hidden');
        placeholder.innerHTML = '<p style="color: #ef4444; font-weight: 600; font-size: 0.75rem;">Error rendering image.</p>';
    } finally {
        loading.classList.remove('show');
        generateBtn.disabled = false;
    }
}

/* ============================================
   AUDIO HELPER FUNCTIONS
   ============================================ */
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function pcmToWav(pcm16Data, sampleRate = 24000) {
    const numChannels = 1;
    const dataSize = pcm16Data.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(v, offset, str) {
        for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < pcm16Data.length; i++, offset += 2) {
        view.setInt16(offset, pcm16Data[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

// Add CSS animation for spinner
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);


// =====================================
// WILDVENTURE CONTACT FORM
// =====================================

const contactForm = document.getElementById("contactForm");
const toast = document.getElementById("toast");


// -------------------------------------
// Form Submit (guarded — only runs on contact page)
// -------------------------------------

if (contactForm) {
  contactForm.addEventListener("submit", function (event) {

    // Stop page reload
    event.preventDefault();


    // Show success message
    if (toast) toast.classList.add("show");


    // Clear form
    contactForm.reset();


    // Hide toast after 3 seconds
    setTimeout(function () {

      if (toast) toast.classList.remove("show");

    }, 3000);

  });
}


// =====================================
// SCROLL TO TOP BUTTON
// =====================================

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', function () {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  if (window.scrollY > 400) {
    btn.classList.add('show');
  } else {
    btn.classList.remove('show');
  }
});


// =====================================
// NAVBAR — SCROLL SHADOW EFFECT
// =====================================

window.addEventListener('scroll', function () {
  const header = document.querySelector('.hm-head1');
  if (!header) return;
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});


// =====================================
// STATS COUNTER ANIMATION (About Page)
// =====================================

function animateCounters() {
  const counters = document.querySelectorAll('.stat-number');
  counters.forEach(function (counter) {
    const target = parseInt(counter.getAttribute('data-target'), 10);
    const prefix = counter.getAttribute('data-prefix') || '';
    const suffix = counter.getAttribute('data-suffix') || '';
    const duration = 2000;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(eased * target);
      counter.textContent = prefix + value.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

// Trigger counter when stats section enters viewport
const statsSection = document.querySelector('.stats-section');
if (statsSection) {
  let counted = false;
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !counted) {
        counted = true;
        animateCounters();
      }
    });
  }, { threshold: 0.3 });
  observer.observe(statsSection);
}


/* =====================================
   PROFESSIONAL SITE-WIDE ANIMATIONS
   ===================================== */

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----- Shared animation styles -----

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Preloader */
    .wv-preloader{position:fixed;inset:0;z-index:99999;background:#4c280c;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;transition:opacity .55s ease,visibility .55s ease;}
    .wv-preloader.hide{opacity:0;visibility:hidden;pointer-events:none;}
    .wv-preloader .wv-loader{position:relative;width:56px;height:56px;}
    .wv-preloader .wv-loader i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff9f4;font-size:20px;z-index:1;}
    .wv-preloader .wv-loader span{position:absolute;inset:0;border:3px solid rgba(255,255,255,.25);border-top-color:#e16a12;border-radius:50%;animation:wvspin 1s linear infinite;}
    .wv-preloader h6{margin:0;color:#fff9f4;font-family:'Poppins',sans-serif;font-weight:600;font-size:13px;letter-spacing:5px;text-transform:uppercase;animation:wvpulse 1.6s ease-in-out infinite;}
    @keyframes wvspin{to{transform:rotate(360deg);}}
    @keyframes wvpulse{0%,100%{opacity:1;}50%{opacity:.3;}}
    /* Scroll progress bar */
    .scroll-progress{position:fixed;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,#e16a12,#f59e0b);z-index:99998;box-shadow:0 0 10px rgba(225,106,18,.55);transition:width .1s linear;}
    /* Navbar hide/reveal on scroll */
    .hm-head1{transition:transform .4s ease,background-color .4s ease,box-shadow .4s ease;}
    .hm-head1.nav-hidden{transform:translateY(-110%);}
    /* Button click ripple */
    .btn-ripple{position:absolute;border-radius:50%;background:rgba(255,255,255,.5);transform:scale(0);animation:wvripple .6s ease-out forwards;pointer-events:none;}
    @keyframes wvripple{to{transform:scale(1);opacity:0;}}
  `;
  document.head.appendChild(styleEl);

  // ----- 1. Branded preloader -----

  if (!reduceMotion) {
    const preloader = document.createElement('div');
    preloader.className = 'wv-preloader';
    preloader.setAttribute('aria-hidden', 'true');
    preloader.innerHTML =
      '<div class="wv-loader"><i class="fa-solid fa-paper-plane"></i><span></span></div>' +
      '<h6>WildVenture</h6>';
    document.body.prepend(preloader);

    function hidePreloader() {
      preloader.classList.add('hide');
      setTimeout(function () {
        if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      }, 600);
    }

    if (document.readyState === 'complete') {
      setTimeout(hidePreloader, 250);
    } else {
      window.addEventListener('load', function () { setTimeout(hidePreloader, 250); });
      setTimeout(hidePreloader, 2000);
    }
  }

  // ----- 2. Scroll progress bar -----

  const progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  document.body.prepend(progressBar);

  let progressTicking = false;
  function updateProgress() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    progressBar.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
    progressTicking = false;
  }
  window.addEventListener('scroll', function () {
    if (!progressTicking) {
      requestAnimationFrame(updateProgress);
      progressTicking = true;
    }
  }, { passive: true });
  updateProgress();

  // ----- 3. Navbar hide on scroll down / reveal on scroll up -----

  const header = document.querySelector('.hm-head1');
  if (header) {
    let lastY = window.scrollY || 0;
    let navTicking = false;
    function onNavScroll() {
      const y = window.scrollY || 0;
      if (window.innerWidth >= 992) {
        if (y > lastY && y > 160) {
          header.classList.add('nav-hidden');
        } else {
          header.classList.remove('nav-hidden');
        }
      } else {
        header.classList.remove('nav-hidden');
      }
      lastY = y;
      navTicking = false;
    }
    window.addEventListener('scroll', function () {
      if (!navTicking) {
        requestAnimationFrame(onNavScroll);
        navTicking = true;
      }
    }, { passive: true });
  }

  // ----- 4. Button click ripple -----

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(function () {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 650);
  });

})();
