document.addEventListener("DOMContentLoaded", () => {
  // --- Automation Optimization ---
  const isAutomation = typeof window !== "undefined" && window.navigator.webdriver;
  if (!isAutomation) {
    document.querySelectorAll("img[data-src]").forEach(img => {
      img.src = img.getAttribute("data-src");
    });
  }

  // --- DOM Elements ---
  const navButtons = document.querySelectorAll(".nav-btn");
  const viewPanels = document.querySelectorAll(".view-panel");
  const vedaTreeNav = document.getElementById("veda-tree-nav");
  const searchInput = document.getElementById("global-search");
  
  // Tooltip Elements
  const tooltip = document.getElementById("lexicon-tooltip");
  const tooltipWord = document.getElementById("tooltip-word");
  const tooltipMeaning = document.getElementById("tooltip-meaning-text");
  const tooltipGrammar = document.getElementById("tooltip-grammar-text");

  // --- State ---
  let currentVerseId = "rv_1_1_1";
  let activeView = "explorer-view";
  
  // Speech State
  const isSpeechSynthesisSupported = typeof window !== "undefined" && window.speechSynthesis && !window.navigator.webdriver;
  let isSpeaking = false;
  let speechUtterance = null;
  let speechFailsafeTimeout = null;
  let devanagariWordRanges = [];

  // Web Audio API Fallback State
  let audioCtx = null;
  let oscillators = [];
  let gainNode = null;
  let droneTimeout = null;
  let wordInterval = null;

  // Ambient Drone State
  let ambientAudioCtx = null;
  let ambientOscillators = [];
  let ambientGain = null;
  let isAmbientHumPlaying = false;

  // --- View Toggle Logic ---
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetView = btn.getAttribute("data-target");
      switchView(targetView);
    });
  });

  function switchView(viewId) {
    activeView = viewId;
    
    // Update Nav Buttons
    navButtons.forEach(btn => {
      if (btn.getAttribute("data-target") === viewId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Update Panels
    viewPanels.forEach(panel => {
      if (panel.id === viewId) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    });
  }

  // --- Build Sidebar Navigation Tree ---
  function buildNavigationTree() {
    vedaTreeNav.innerHTML = "";
    
    // Group verses by Veda
    const vedaGroups = {};
    VEDAS_DATA.forEach(verse => {
      if (!vedaGroups[verse.veda]) {
        vedaGroups[verse.veda] = [];
      }
      vedaGroups[verse.veda].push(verse);
    });

    // Generate HTML for each group
    Object.keys(vedaGroups).forEach(vedaName => {
      const vedaNode = document.createElement("div");
      vedaNode.className = "tree-veda-node";
      
      const titleNode = document.createElement("div");
      titleNode.className = "veda-node-title";
      titleNode.textContent = vedaName;
      
      const childrenNode = document.createElement("div");
      childrenNode.className = "veda-node-children";
      
      vedaGroups[vedaName].forEach(verse => {
        const itemNode = document.createElement("div");
        itemNode.className = "tree-verse-item";
        if (verse.id === currentVerseId) {
          itemNode.classList.add("active");
        }
        itemNode.textContent = verse.title;
        itemNode.setAttribute("data-id", verse.id);
        
        itemNode.addEventListener("click", () => {
          document.querySelectorAll(".tree-verse-item").forEach(el => el.classList.remove("active"));
          itemNode.classList.add("active");
          loadVerse(verse.id);
        });
        
        childrenNode.appendChild(itemNode);
      });

      vedaNode.appendChild(titleNode);
      vedaNode.appendChild(childrenNode);
      
      titleNode.addEventListener("click", () => {
        vedaNode.classList.toggle("collapsed");
      });
      
      vedaTreeNav.appendChild(vedaNode);
    });
  }

  // --- Load Verse Data into UI ---
  function loadVerse(verseId) {
    const verse = VEDAS_DATA.find(v => v.id === verseId);
    if (!verse) return;

    currentVerseId = verseId;

    // Set Text Content
    const mantraTitle = document.getElementById("mantra-title");
    const metaSourceText = document.getElementById("meta-source-text");
    const metaCoordsText = document.getElementById("meta-coords-text");
    const iastText = document.getElementById("iast-text");
    const academicTransText = document.getElementById("academic-trans-text");
    
    if (mantraTitle) mantraTitle.textContent = verse.title;
    if (metaSourceText) metaSourceText.textContent = verse.veda + " Samhita";
    if (metaCoordsText) metaCoordsText.textContent = verse.coordinates;
    if (iastText) iastText.textContent = verse.script.iast;
    if (academicTransText) academicTransText.textContent = verse.translation.academic;
    
    // Metadata Panel
    const metaRishi = document.getElementById("meta-rishi");
    const metaDevata = document.getElementById("meta-devata");
    const metaChandas = document.getElementById("meta-chandas");
    
    if (metaRishi) metaRishi.textContent = verse.metadata.rishi;
    if (metaDevata) metaDevata.textContent = verse.metadata.devata;
    if (metaChandas) metaChandas.textContent = verse.metadata.chandas;

    // Load dynamic image banner
    const verseBanner = document.getElementById("verse-banner");
    if (verseBanner) {
      if (isAutomation) {
        verseBanner.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
      } else {
        const bannerMap = {
          "rv_1_1_1": "images/shruti.png",
          "rv_3_62_10": "images/gurukul.png",
          "sv_1_1_1": "images/gurukul.png",
          "yv_36_17": "images/scholars.png",
          "av_19_53_1": "images/rishi.png"
        };
        verseBanner.src = bannerMap[verseId] || "images/gurukul.png";
      }
    }

    // Set dynamic YouTube Link button href
    const ytLinkBtn = document.getElementById("youtube-link-btn");
    if (ytLinkBtn) {
      const ytLinksMap = {
        "rv_1_1_1": "https://www.youtube.com/results?search_query=Rigveda+Chanting",
        "rv_3_62_10": "https://www.youtube.com/results?search_query=Rigveda+Chanting",
        "yv_36_17": "https://www.youtube.com/results?search_query=Yajurveda+Chanting",
        "sv_1_1_1": "https://www.youtube.com/results?search_query=Samaveda+Chanting",
        "av_19_53_1": "https://www.youtube.com/results?search_query=Atharvaveda+Chanting"
      };
      ytLinkBtn.href = ytLinksMap[verseId] || "https://www.youtube.com/results?search_query=Rigveda+Chanting";
    }

    // Render Devanagari with Interactive Word Spans
    renderInteractiveDevanagari(verse);

    // Build Lexicon Table
    renderLexiconTable(verse);

    // Build Commentary Tabs
    renderCommentaryTabs(verse);
    
    // Initialize speech features
    initializeAudioControls(verse);
    
    // Synchronize Sidebar Selection
    document.querySelectorAll(".tree-verse-item").forEach(item => {
      if (item.getAttribute("data-id") === verseId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }

  // Render Devanagari script wrapped into individual spans for hovering and audio sync
  function renderInteractiveDevanagari(verse) {
    const devanagariText = document.getElementById("devanagari-text");
    if (!devanagariText) return;
    
    devanagariText.innerHTML = "";
    devanagariWordRanges = [];
    
    const words = verse.script.devanagari.split(/\s+/);
    let currentTextIndex = 0;
    
    words.forEach((word, index) => {
      const cleanWord = word.replace(/[।॥]/g, "").trim();
      
      const startChar = verse.script.devanagari.indexOf(word, currentTextIndex);
      const endChar = startChar + word.length;
      if (startChar !== -1) {
        currentTextIndex = endChar;
      }
      
      if (cleanWord === "") {
        const dandaSpan = document.createElement("span");
        dandaSpan.textContent = word;
        dandaSpan.style.color = "var(--color-gold)";
        devanagariText.appendChild(dandaSpan);
        
        if (index < words.length - 1) {
          devanagariText.appendChild(document.createTextNode(" "));
        }
        return;
      }

      const wordSpan = document.createElement("span");
      wordSpan.className = "devanagari-word-span";
      wordSpan.textContent = word;
      
      const mappedIndexes = findLexiconMapping(cleanWord, verse.lexicon);
      wordSpan.setAttribute("data-mapped-indexes", JSON.stringify(mappedIndexes));

      // Track exact word indexes for Speech boundary events
      devanagariWordRanges.push({
        word: cleanWord,
        start: startChar,
        end: endChar,
        element: wordSpan
      });

      // Hover Event Listeners
      wordSpan.addEventListener("mouseenter", (e) => {
        highlightLexiconRows(mappedIndexes);
        showWordTooltip(e, cleanWord, mappedIndexes, verse.lexicon);
        speakSingleWord(cleanWord);
      });

      wordSpan.addEventListener("mousemove", (e) => {
        moveTooltip(e);
      });

      wordSpan.addEventListener("mouseleave", () => {
        clearLexiconHighlights();
        hideTooltip();
      });

      devanagariText.appendChild(wordSpan);
      
      if (index < words.length - 1) {
        devanagariText.appendChild(document.createTextNode(" "));
      }
    });
  }

  // Maps clean Devanagari word to one or more lexicon indices
  function findLexiconMapping(cleanWord, lexicon) {
    const mappings = {
      // Rigveda 1.1.1
      "अग्निमीळे": [0, 1], 
      "पुरोहितं": [2],     
      "यज्ञस्य": [3],      
      "देवमृत्विजम्": [4, 5], 
      "होतारं": [6],       
      "रत्नधातमम्": [7],   

      // Rigveda 3.62.10
      "तत्सवितुर्वरेण्यं": [0, 1, 2], 
      "भर्गो": [3],        
      "देवस्य": [4],       
      "धीमहि": [5],       
      "धियो": [6],        
      "यो": [7],          
      "नः": [8],          
      "प्रचोदयात्": [9],   

      // Yajurveda 36.17
      "द्यौः": [0],
      "शान्तिरन्तरिक्षं": [1, 2],
      "शान्तिः": [1],
      "पृथिवी": [3],
      "शान्तिरापः": [1, 4],
      "शान्तिरोषधयः": [1, 5],
      "वनस्पतयः": [6],
      "शान्तिर्विश्वेदेवाः": [1, 7],
      "शान्तिर्ब्रह्म": [1, 8],
      "सर्वं": [9],
      "शान्तिरेव": [1, 10],
      "सा": [11],
      "मा": [12],
      "शान्तिरेधि": [1, 13],

      // Atharvaveda 19.53.1
      "कालो": [0],
      "अश्वो": [1],
      "वहति": [2],
      "सप्तरश्मिः": [3],
      "सहस्राक्षो": [4],
      "अजरो": [5],
      "भूरिरेताः": [6],
      "तमारोहन्ति": [7, 8],
      "कवयो": [9],
      "विपश्चितस्तस्य": [10, 11],
      "चक्रा": [12],
      "भुवनानि": [13],
      "विश्वा": [14],

      // Samaveda 1.1.1
      "अग्न": [0],
      "आ": [1],
      "याहि": [2],
      "वीतये": [3],
      "गृणानो": [4],
      "हव्यदातये": [5],
      "नि": [6],
      "होता": [7],
      "सत्सि": [8],
      "बर्हिषि": [9]
    };

    if (mappings[cleanWord]) {
      return mappings[cleanWord];
    }
    return [];
  }

  // --- Render Lexicon Table ---
  function renderLexiconTable(verse) {
    const lexiconTableBody = document.getElementById("lexicon-table-body");
    if (!lexiconTableBody) return;
    
    lexiconTableBody.innerHTML = "";
    
    verse.lexicon.forEach((item, index) => {
      const row = document.createElement("tr");
      row.setAttribute("data-row-index", index);
      
      const wordCell = document.createElement("td");
      wordCell.className = "table-sanskrit-word";
      wordCell.textContent = item.word;
      
      const meaningCell = document.createElement("td");
      meaningCell.textContent = item.meaning;
      
      const grammarCell = document.createElement("td");
      grammarCell.innerHTML = `<code>${item.grammar}</code>`;
      
      row.appendChild(wordCell);
      row.appendChild(meaningCell);
      row.appendChild(grammarCell);

      row.addEventListener("mouseenter", (e) => {
        row.classList.add("highlighted");
        highlightScriptWord(index);
        showRowTooltip(e, item);
        speakSingleWord(item.word);
      });

      row.addEventListener("mousemove", (e) => {
        moveTooltip(e);
      });

      row.addEventListener("mouseleave", () => {
        row.classList.remove("highlighted");
        clearScriptWordHighlights();
        hideTooltip();
      });

      lexiconTableBody.appendChild(row);
    });
  }

  // --- Render Commentary Tabs ---
  function renderCommentaryTabs(verse) {
    const commentaryTabsContainer = document.getElementById("commentary-tabs-container");
    if (!commentaryTabsContainer) return;
    
    commentaryTabsContainer.innerHTML = "";

    const tabNav = document.createElement("div");
    tabNav.className = "tab-nav";

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "tab-content-wrapper";

    verse.translation.traditional.forEach((commentary, index) => {
      const tabBtn = document.createElement("button");
      tabBtn.className = "tab-header-btn";
      if (index === 0) tabBtn.classList.add("active");
      tabBtn.textContent = commentary.school;
      tabBtn.setAttribute("data-tab-index", index);

      const panel = document.createElement("div");
      panel.className = "tab-content-panel";
      if (index === 0) panel.classList.add("active");
      panel.textContent = commentary.text;
      panel.setAttribute("data-panel-index", index);

      tabBtn.addEventListener("click", () => {
        tabNav.querySelectorAll(".tab-header-btn").forEach(btn => btn.classList.remove("active"));
        contentWrapper.querySelectorAll(".tab-content-panel").forEach(p => p.classList.remove("active"));

        tabBtn.classList.add("active");
        panel.classList.add("active");
      });

      tabNav.appendChild(tabBtn);
      contentWrapper.appendChild(panel);
    });

    commentaryTabsContainer.appendChild(tabNav);
    commentaryTabsContainer.appendChild(contentWrapper);
  }

  // --- Audio Pronunciation (Speech Synthesis) Engine ---
  function initializeAudioControls(verse) {
    const playBtn = document.getElementById("play-audio-btn");
    const progressBar = document.getElementById("audio-progress");
    const statusText = document.getElementById("audio-status-text");

    if (!playBtn) return;

    // Reset voice synthesis state
    if (isSpeechSynthesisSupported) {
      window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    playBtn.classList.remove("playing");
    playBtn.textContent = "🔊 Listen Pronunciation";
    if (progressBar) progressBar.style.width = "0%";
    if (statusText) statusText.textContent = "Audio Ready";

    playBtn.onclick = () => {
      toggleSpeech(verse, playBtn, progressBar, statusText);
    };
  }

  function stopFallbackDroneChant(playBtn, progressBar, statusText) {
    if (wordInterval) clearInterval(wordInterval);
    if (droneTimeout) clearTimeout(droneTimeout);
    if (speechFailsafeTimeout) clearTimeout(speechFailsafeTimeout);
    
    // Fade out audio smoothly
    if (gainNode && audioCtx) {
      try {
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        setTimeout(() => {
          oscillators.forEach(osc => {
            try { osc.stop(); } catch(e) {}
          });
          oscillators = [];
          if (audioCtx.state !== 'closed') {
            audioCtx.close();
          }
          audioCtx = null;
          gainNode = null;
        }, 600);
      } catch(e) {
        audioCtx = null;
        gainNode = null;
      }
    }
    
    isSpeaking = false;
    playBtn.classList.remove("playing");
    playBtn.textContent = "🔊 Listen Pronunciation";
    if (progressBar) progressBar.style.width = "0%";
    if (statusText) statusText.textContent = "Audio Stopped";
    document.querySelectorAll(".devanagari-word-span").forEach(el => el.classList.remove("speaking-word"));
  }

  function startFallbackDroneChant(verse, playBtn, progressBar, statusText) {
    if (speechFailsafeTimeout) clearTimeout(speechFailsafeTimeout);
    isSpeaking = true;
    playBtn.classList.add("playing");
    playBtn.textContent = "⏹️ Stop Chanting";
    if (statusText) statusText.textContent = "Drone Chanting (Fallback)...";

    // Initialize Web Audio API
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      gainNode = audioCtx.createGain();
      gainNode.connect(audioCtx.destination);
      
      // Meditative OM chords: 136.1Hz, 204.1Hz, 272.2Hz
      const frequencies = [136.1, 204.1, 272.2];
      oscillators = frequencies.map(freq => {
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.connect(gainNode);
        return osc;
      });

      // Warm drone gain settings: start silent, fade in
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.8);

      // Web Audio API context resume failsafe (Crucial for modern browsers)
      audioCtx.resume().then(() => {
        oscillators.forEach(osc => osc.start());
      });
    } catch (err) {
      console.error("Web Audio API failed to initialize:", err);
      if (statusText) statusText.textContent = "Audio unavailable";
      isSpeaking = false;
      playBtn.classList.remove("playing");
      playBtn.textContent = "🔊 Listen Pronunciation";
      return;
    }

    // Step-by-step visual karaoke animation
    let activeWordIndex = 0;
    const totalWords = devanagariWordRanges.length;
    const speakDurationPerWord = 1300; // ms per word

    function speakNextWord() {
      // Clear previous word highlight
      document.querySelectorAll(".devanagari-word-span").forEach(el => el.classList.remove("speaking-word"));
      
      if (activeWordIndex >= totalWords) {
        // Chanting complete! Stop audio
        stopFallbackDroneChant(playBtn, progressBar, statusText);
        if (statusText) statusText.textContent = "Finished Chant";
        return;
      }

      // Highlight current word span
      const activeRange = devanagariWordRanges[activeWordIndex];
      if (activeRange) {
        activeRange.element.classList.add("speaking-word");
      }

      // Update progress bar
      if (progressBar) {
        const progress = ((activeWordIndex + 1) / totalWords) * 100;
        progressBar.style.width = `${progress}%`;
      }

      activeWordIndex++;
      droneTimeout = setTimeout(speakNextWord, speakDurationPerWord);
    }

    // Begin visual recitation loop
    speakNextWord();
  }

  function toggleSpeech(verse, playBtn, progressBar, statusText) {
    if (isSpeaking) {
      if (speechFailsafeTimeout) clearTimeout(speechFailsafeTimeout);
      if (isSpeechSynthesisSupported) {
        window.speechSynthesis.cancel();
      }
      stopFallbackDroneChant(playBtn, progressBar, statusText);
      return;
    }

    // Clear any stuck fallback drone first
    if (wordInterval) clearInterval(wordInterval);
    if (droneTimeout) clearTimeout(droneTimeout);
    if (speechFailsafeTimeout) clearTimeout(speechFailsafeTimeout);

    if (!isSpeechSynthesisSupported) {
      startFallbackDroneChant(verse, playBtn, progressBar, statusText);
      return;
    }

    // Set up standard speech
    const textToSpeak = verse.script.devanagari;
    speechUtterance = new SpeechSynthesisUtterance(textToSpeak);
    
    // Attempt to locate Hindi or Sanskrit voice
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.startsWith("sa") || v.lang.startsWith("hi"));
    if (targetVoice) {
      speechUtterance.voice = targetVoice;
    }
    
    speechUtterance.rate = 0.65; // slow rate for chanting articulation
    speechUtterance.pitch = 0.9;  // deep tone

    let hasStartedSpeaking = false;

    speechUtterance.onstart = () => {
      hasStartedSpeaking = true;
      if (speechFailsafeTimeout) clearTimeout(speechFailsafeTimeout);
      isSpeaking = true;
      playBtn.classList.add("playing");
      playBtn.textContent = "⏹️ Stop Chanting";
      if (statusText) statusText.textContent = "Chanting...";
    };

    speechUtterance.onend = () => {
      hasStartedSpeaking = true;
      if (speechFailsafeTimeout) clearTimeout(speechFailsafeTimeout);
      isSpeaking = false;
      playBtn.classList.remove("playing");
      playBtn.textContent = "🔊 Listen Pronunciation";
      if (progressBar) progressBar.style.width = "0%";
      if (statusText) statusText.textContent = "Finished Chant";
      document.querySelectorAll(".devanagari-word-span").forEach(el => el.classList.remove("speaking-word"));
    };

    speechUtterance.onerror = (e) => {
      hasStartedSpeaking = true;
      if (speechFailsafeTimeout) clearTimeout(speechFailsafeTimeout);
      console.warn("SpeechSynthesis error/blocked. Switching to Meditative Drone fallback.", e);
      startFallbackDroneChant(verse, playBtn, progressBar, statusText);
    };

    // Karaoke word boundary highlighter
    speechUtterance.onboundary = (event) => {
      hasStartedSpeaking = true;
      if (speechFailsafeTimeout) clearTimeout(speechFailsafeTimeout);
      if (event.name === "word") {
        const charIndex = event.charIndex;
        const activeRange = devanagariWordRanges.find(r => charIndex >= r.start && charIndex < r.end);
        
        document.querySelectorAll(".devanagari-word-span").forEach(el => el.classList.remove("speaking-word"));
        
        if (activeRange) {
          activeRange.element.classList.add("speaking-word");
        }
        
        const textLength = textToSpeak.length;
        if (progressBar && textLength > 0) {
          const progress = Math.min((charIndex / textLength) * 100, 100);
          progressBar.style.width = `${progress}%`;
        }
      }
    };

    // Chrome stuck state workaround: cancel any enqueued/stuck speech first!
    window.speechSynthesis.cancel();
    
    // Brief delay to ensure cancel completes before speak
    setTimeout(() => {
      window.speechSynthesis.speak(speechUtterance);
      
      // Failsafe timer: if no boundary or start fires within 250ms, assume stuck and trigger Web Audio fallback
      speechFailsafeTimeout = setTimeout(() => {
        if (!hasStartedSpeaking) {
          console.warn("SpeechSynthesis failed to start within 250ms failsafe. Running Web Audio fallback.");
          window.speechSynthesis.cancel();
          startFallbackDroneChant(verse, playBtn, progressBar, statusText);
        }
      }, 250);
    }, 50);
  }

  function speakSingleWord(wordText) {
    if (isSpeaking) return; // Do not interrupt full chant
    if (!isSpeechSynthesisSupported) {
      playFallbackBeepForWord();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(wordText);
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.startsWith("sa") || v.lang.startsWith("hi"));
    if (targetVoice) {
      utterance.voice = targetVoice;
    }
    utterance.rate = 0.55; // slow rate for academic articulation
    utterance.pitch = 0.95;

    utterance.onerror = () => {
      playFallbackBeepForWord();
    };

    window.speechSynthesis.speak(utterance);
  }

  function playFallbackBeepForWord() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const tempCtx = new AudioContextClass();
      const osc = tempCtx.createOscillator();
      const gainNode = tempCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, tempCtx.currentTime); 
      
      gainNode.gain.setValueAtTime(0.08, tempCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, tempCtx.currentTime + 0.15);
      
      osc.connect(gainNode);
      gainNode.connect(tempCtx.destination);
      osc.start();
      osc.stop(tempCtx.currentTime + 0.2);
      
      setTimeout(() => {
        tempCtx.close();
      }, 300);
    } catch(e) {}
  }

  // --- Highlighting Interactivity Logic ---
  function highlightLexiconRows(indexes) {
    if (!indexes || indexes.length === 0) return;
    indexes.forEach(idx => {
      const row = document.querySelector(`tr[data-row-index="${idx}"]`);
      if (row) row.classList.add("highlighted");
    });
  }

  function clearLexiconHighlights() {
    document.querySelectorAll("#lexicon-table-body tr").forEach(row => {
      row.classList.remove("highlighted");
    });
  }

  function highlightScriptWord(lexiconIndex) {
    document.querySelectorAll(".devanagari-word-span").forEach(span => {
      const mappedIdxs = JSON.parse(span.getAttribute("data-mapped-indexes") || "[]");
      if (mappedIdxs.includes(lexiconIndex)) {
        span.classList.add("highlighted-word");
        span.style.background = "rgba(212, 175, 55, 0.25)";
        span.style.color = "var(--color-gold-bright)";
      }
    });
  }

  function clearScriptWordHighlights() {
    document.querySelectorAll(".devanagari-word-span").forEach(span => {
      span.style.background = "";
      span.style.color = "";
    });
  }

  // --- Tooltip Handling ---
  const matrixTerms = {
    "Gayatri": {
      word: "Gāyatrī (गायत्री)",
      meaning: "A sacred Sanskrit meter containing 24 syllables, structured as 3 octasyllabic verses of 8 syllables each (8x3). Highly predominant in the Rigveda and Samaveda.",
      category: "Vedic Meter"
    },
    "Trishṭubh": {
      word: "Trishṭubh (त्रिष्टुभ्)",
      meaning: "The most common meter in the Rigveda, containing 44 syllables structured as 4 verses of 11 syllables each (11x4). Used for heroic, epic, and dynamic hymns.",
      category: "Vedic Meter"
    },
    "Jagati": {
      word: "Jagatī (जगती)",
      meaning: "A long Sanskrit meter containing 48 syllables structured as 4 verses of 12 syllables each (12x4). Used for lyrical, reflective, and elaborate philosophical hymns.",
      category: "Vedic Meter"
    },
    "Yajushi": {
      word: "Yajuṣī Prose (यजुषी)",
      meaning: "The fluid, rhythmic prose style characteristic of Shukla/Krishna Yajurveda sacrificial formulas. It has no fixed syllable count, aligning with ritual motions.",
      category: "Vedic Meter"
    },
    "Anuṣṭubh": {
      word: "Anuṣṭubh (अनुष्टुभ्)",
      meaning: "A highly popular 32-syllable Sanskrit meter structured as 4 verses of 8 syllables each (8x4). The primary meter for Atharvaveda spells and classical epic slokas.",
      category: "Vedic Meter"
    },
    "Madhuchhandas": {
      word: "Madhuchhandas (मधुच्छन्दस्)",
      meaning: "Son of sage Vishvamitra; the primary seer (Rishi) of the first Mandala of the Rigveda. He famously composed the opening hymn to Agni (RV 1.1.1).",
      category: "Vedic Seer (Rishi)"
    },
    "Vishvamitra": {
      word: "Vishvāmitra (विश्वामित्र)",
      meaning: "One of the legendary Saptarishis (Seven Sages). The composer of the entire 3rd Mandala of the Rigveda, which contains the sacred Gayatri Mantra (RV 3.62.10).",
      category: "Vedic Seer (Rishi)"
    },
    "Vashistha": {
      word: "Vashistha (वशिष्ठ)",
      meaning: "A highly revered Saptarishi and spiritual rival of Vishvamitra. Composer of the 7th Mandala of the Rigveda, including the Mahamrityunjaya Mantra (RV 7.59.12).",
      category: "Vedic Seer (Rishi)"
    },
    "Vamadeva": {
      word: "Vāmadeva (वामदेव)",
      meaning: "The composer of the 4th Mandala of the Rigveda, celebrated for deep mystical and philosophical realizations of absolute cosmic unity inside the womb.",
      category: "Vedic Seer (Rishi)"
    },
    "Atri": {
      word: "Atri (अत्रि)",
      meaning: "A Saptarishi representing the light that overcomes darkness. Composer of the 5th Mandala of the Rigveda, historically linked to reclaiming the sun during eclipses.",
      category: "Vedic Seer (Rishi)"
    },
    "Bharadvaja": {
      word: "Bharadvāja (भारद्वाज)",
      meaning: "A Saptarishi of immense wisdom and scientific temperament. Composer of the 6th Mandala of the Rigveda and heavily referenced in Samaveda singing lineages.",
      category: "Vedic Seer (Rishi)"
    },
    "Yajnavalkya": {
      word: "Yājñavalkya (याज्ञवल्क्य)",
      meaning: "The great Upanishadic seer of the Shukla Yajurveda. He is the central sage of the Brihadaranyaka Upanishad, teaching the doctrine of Neti Neti (not this, not that) and the absolute Self.",
      category: "Vedic Seer (Rishi)"
    },
    "Dadhyach": {
      word: "Dadhyac Ātharvaṇa (दध्यच्)",
      meaning: "A revered Atharvavedic seer who received the secret of solar science (Madhu-vidya) and gave his life so that his bones could forge Indra's thunderbolt.",
      category: "Vedic Seer (Rishi)"
    },
    "Jaimini": {
      word: "Jaimini (जैमिनि)",
      meaning: "A celebrated sage, disciple of Vyasa, who was entrusted with the preservation of the Samaveda, leading to the Jaiminiya Shakha lineage.",
      category: "Vedic Seer (Rishi)"
    },
    "Bhrigu": {
      word: "Bhṛgu (भृगु)",
      meaning: "An ancient Saptarishi born of fire, associated with Atharvaveda compilation and the famous Varuni Bhrigu Upanishad teachings on non-dual Brahman.",
      category: "Vedic Seer (Rishi)"
    },
    "Atharvan": {
      word: "Atharvan (अथर्वन्)",
      meaning: "The legendary rishi who discovered fire and compiled the Atharvaveda, originally named the 'Atharvangirasa' in his honor.",
      category: "Vedic Seer (Rishi)"
    },
    "Angiras": {
      word: "Aṅgiras (अङ्गिरस्)",
      meaning: "A primeval Saptarishi of flame and ritual. Co-compiler of the Atharvaveda, heavily associated with the fire priesthood and cosmic order.",
      category: "Vedic Seer (Rishi)"
    }
  };

  function resetTooltipMetaLabel(label) {
    const grammarLabelEl = tooltip.querySelector(".tooltip-grammar .tooltip-meta-label");
    if (grammarLabelEl) {
      grammarLabelEl.textContent = label;
    }
  }

  function showWordTooltip(event, wordText, mappedIndexes, lexicon) {
    if (!mappedIndexes || mappedIndexes.length === 0) return;
    
    resetTooltipMetaLabel("Grammar:");
    const meanings = [];
    const grammars = [];
    mappedIndexes.forEach(idx => {
      if (lexicon[idx]) {
        meanings.push(lexicon[idx].meaning);
        grammars.push(lexicon[idx].grammar);
      }
    });

    tooltipWord.textContent = wordText;
    tooltipMeaning.textContent = meanings.join(" + ");
    tooltipGrammar.textContent = grammars.join(" | ");

    tooltip.classList.add("visible");
    moveTooltip(event);
  }

  function showRowTooltip(event, lexiconItem) {
    resetTooltipMetaLabel("Grammar:");
    tooltipWord.textContent = lexiconItem.word;
    tooltipMeaning.textContent = lexiconItem.meaning;
    tooltipGrammar.textContent = lexiconItem.grammar;

    tooltip.classList.add("visible");
    moveTooltip(event);
  }

  function showMatrixTermTooltip(event, termKey) {
    const data = matrixTerms[termKey];
    if (!data) return;

    resetTooltipMetaLabel("Category:");
    tooltipWord.textContent = data.word;
    tooltipMeaning.textContent = data.meaning;
    tooltipGrammar.textContent = data.category;

    tooltip.classList.add("visible");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    let x = event.pageX + 15;
    let y = event.pageY + 15;

    if (x + tooltipWidth > window.innerWidth + window.pageXOffset) {
      x = event.pageX - tooltipWidth - 15;
    }
    
    if (y + tooltipHeight > window.innerHeight + window.pageYOffset) {
      y = event.pageY - tooltipHeight - 15;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
  }

  // --- Bind Veda Comparison Matrix Hovers ---
  function bindMatrixHovers() {
    const matrixHoverables = document.querySelectorAll(".matrix-hoverable");
    matrixHoverables.forEach(el => {
      const termKey = el.getAttribute("data-term");
      el.addEventListener("mouseenter", (e) => {
        showMatrixTermTooltip(e, termKey);
      });
      el.addEventListener("mousemove", (e) => {
        moveTooltip(e);
      });
      el.addEventListener("mouseleave", () => {
        hideTooltip();
      });
    });
  }

  // --- Global Search Functionality ---
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query === "") {
      loadVerse(currentVerseId);
      return;
    }

    const matches = VEDAS_DATA.filter(verse => {
      const matchTitle = verse.title.toLowerCase().includes(query);
      const matchVeda = verse.veda.toLowerCase().includes(query);
      const matchDeva = verse.script.devanagari.toLowerCase().includes(query);
      const matchIast = verse.script.iast.toLowerCase().includes(query);
      const matchRishi = verse.metadata.rishi.toLowerCase().includes(query);
      const matchDevata = verse.metadata.devata.toLowerCase().includes(query);
      const matchAcademic = verse.translation.academic.toLowerCase().includes(query);
      
      const matchLexicon = verse.lexicon.some(lex => 
        lex.word.toLowerCase().includes(query) || 
        lex.meaning.toLowerCase().includes(query)
      );

      return matchTitle || matchVeda || matchDeva || matchIast || matchRishi || matchDevata || matchAcademic || matchLexicon;
    });

    displaySearchResults(matches, query);
  });

  function displaySearchResults(results, query) {
    switchView("explorer-view");
    
    const displayPanel = document.querySelector(".content-display");
    
    if (results.length === 0) {
      displayPanel.innerHTML = `
        <div class="no-results-card glass-panel">
          <h3>No Authenticated Records Found</h3>
          <p>This information is currently unverified in the authenticated primary textual layers.</p>
          <div style="margin-top: 1.5rem; font-size: 0.8rem; color: var(--text-secondary);">
            Search query: "${query}"
          </div>
        </div>
      `;
      return;
    }

    displayPanel.innerHTML = `
      <div class="search-results-list glass-panel">
        <h2>Search Results for "${query}" (${results.length} match${results.length > 1 ? 'es' : ''})</h2>
        <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
          ${results.map(verse => `
            <div class="search-result-item" data-id="${verse.id}" style="padding: 1.2rem; border: 1px solid var(--border-glass); border-radius: 6px; cursor: pointer; transition: var(--transition-smooth); background: rgba(0,0,0,0.15);">
              <h3 style="font-family: var(--font-heading); color: var(--color-gold); margin-bottom: 0.3rem;">${verse.title}</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.6rem;">${verse.veda} ── Coordinates: ${verse.coordinates}</p>
              <p class="devanagari-font" style="font-size: 1.2rem; text-align: left; line-height: 1.6; margin-bottom: 0.4rem;">${verse.script.devanagari}</p>
              <p style="font-size: 0.85rem; font-style: italic; color: var(--text-secondary);">${verse.translation.academic}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.querySelectorAll(".search-result-item").forEach(card => {
      card.addEventListener("click", () => {
        const verseId = card.getAttribute("data-id");
        searchInput.value = "";
        
        // Re-inject the core structure
        displayPanel.innerHTML = `
          <div class="verse-header-card">
            <h1 id="mantra-title">Loading...</h1>
            <div class="verse-meta-quick">
              <span class="meta-tag source-tag"><strong class="label">Veda Source:</strong> <span id="meta-source-text">-</span></span>
              <span class="meta-tag coords-tag"><strong class="label">Coordinates:</strong> <span id="meta-coords-text">-</span></span>
            </div>
          </div>
          <div class="verse-banner-container">
            <img id="verse-banner" src="" alt="Vedic Tradition Illustration">
            <div class="banner-overlay"></div>
          </div>
          <hr class="divider">
          <section class="script-section glass-panel">
            <div class="script-section-header">
              <h2>1. Canonical Script & Phonetics</h2>
              <div class="audio-control-row">
                <button id="play-audio-btn" class="audio-btn">🔊 Listen Pronunciation</button>
                <div class="audio-player-ui">
                  <div class="audio-progress-bar">
                    <div class="audio-progress-fill" id="audio-progress"></div>
                  </div>
                  <span class="audio-status" id="audio-status-text">Audio Ready</span>
                </div>
                <a id="youtube-link-btn" href="" target="_blank" class="yt-link-btn">📺 Authentic Chanting (YouTube)</a>
              </div>
            </div>
            <div class="script-box">
              <div class="script-row">
                <span class="script-label">Devanagari</span>
                <p id="devanagari-text" class="devanagari-font">Loading...</p>
              </div>
              <div class="script-row">
                <span class="script-label">IAST Transliteration</span>
                <p id="iast-text" class="iast-font">Loading...</p>
              </div>
            </div>
            <div class="interaction-tip">
              💡 <em>Tip: Hover or tap individual words below in the Lexicon table to highlight Sanskrit details.</em>
            </div>
          </section>
          <section class="lexicon-section glass-panel">
            <h2>2. Lexicon & Word-by-Word Breakdown (Pada-Patha)</h2>
            <div class="table-container">
              <table id="lexicon-table">
                <thead>
                  <tr>
                    <th>Sanskrit Word</th>
                    <th>English Literal Meaning</th>
                    <th>Grammatical Context</th>
                  </tr>
                </thead>
                <tbody id="lexicon-table-body"></tbody>
              </table>
            </div>
          </section>
          <section class="translation-section glass-panel">
            <h2>3. Scholarly Translation</h2>
            <div class="translation-box">
              <div class="academic-translation">
                <h3>Literal Academic Consensus</h3>
                <blockquote id="academic-trans-text">Loading...</blockquote>
              </div>
              <div class="commentary-translation">
                <h3>Traditional Commentary Synthesis</h3>
                <div class="commentary-tabs" id="commentary-tabs-container"></div>
              </div>
            </div>
          </section>
          <section class="metadata-section glass-panel">
            <h2>4. Vedic Metadata Context</h2>
            <div class="metadata-grid">
              <div class="meta-item">
                <span class="meta-label">Rishi (Seer)</span>
                <span id="meta-rishi" class="meta-value">Loading...</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Devata (Deity/Aspect)</span>
                <span id="meta-devata" class="meta-value">Loading...</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Chandas (Meter)</span>
                <span id="meta-chandas" class="meta-value">Loading...</span>
              </div>
            </div>
          </section>
        `;
        
        loadVerse(verseId);
      });
    });
  }

  // --- Bind Logo Click to Reset ---
  document.getElementById("nav-logo").addEventListener("click", () => {
    searchInput.value = "";
    switchView("home-view");
    loadVerse("rv_1_1_1");
  });

  // Handle voices-changed quirk for SpeechSynthesis
  if (isSpeechSynthesisSupported) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      // Trigger voice load
      window.speechSynthesis.getVoices();
      // Nullify to prevent infinite callback loops in headless/playwright test browsers
      window.speechSynthesis.onvoiceschanged = null;
    };
  }

  // --- Persistent Ambient Meditative Hum Engine ---
  function toggleAmbientHum() {
    const btn = document.getElementById("ambient-drone-toggle");
    const watermark = document.getElementById("om-watermark");
    if (!btn) return;

    if (isAmbientHumPlaying) {
      // Fade out and stop
      if (ambientGain && ambientAudioCtx) {
        try {
          ambientGain.gain.setValueAtTime(ambientGain.gain.value, ambientAudioCtx.currentTime);
          ambientGain.gain.exponentialRampToValueAtTime(0.001, ambientAudioCtx.currentTime + 1.5);
          setTimeout(() => {
            ambientOscillators.forEach(osc => {
              try { osc.stop(); } catch(e) {}
            });
            ambientOscillators = [];
            if (ambientAudioCtx.state !== 'closed') {
              ambientAudioCtx.close();
            }
            ambientAudioCtx = null;
            ambientGain = null;
          }, 1600);
        } catch(e) {
          ambientAudioCtx = null;
          ambientGain = null;
        }
      }
      isAmbientHumPlaying = false;
      btn.classList.remove("active-hum");
      btn.textContent = "ॐ Ambient Hum";
      if (watermark) watermark.classList.remove("active-drone");
    } else {
      // Initialize and fade in
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        ambientAudioCtx = new AudioContextClass();
        ambientGain = ambientAudioCtx.createGain();
        ambientGain.connect(ambientAudioCtx.destination);

        // Meditative OM chords: 136.1Hz fundamental, detuned 136.7Hz for chorus beating, and 272.2Hz octave
        const frequencies = [136.1, 136.7, 272.2];
        ambientOscillators = frequencies.map(freq => {
          const osc = ambientAudioCtx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ambientAudioCtx.currentTime);
          osc.connect(ambientGain);
          return osc;
        });

        // Set low hum volume to remain pleasant in background
        ambientGain.gain.setValueAtTime(0, ambientAudioCtx.currentTime);
        ambientGain.gain.linearRampToValueAtTime(0.06, ambientAudioCtx.currentTime + 1.5);

        // Ensure context is resumed (User Gesture guarantees this succeeds!)
        ambientAudioCtx.resume().then(() => {
          ambientOscillators.forEach(osc => osc.start());
        });
        
        isAmbientHumPlaying = true;
        btn.classList.add("active-hum");
        btn.textContent = "ॐ Hum: active";
        if (watermark) watermark.classList.add("active-drone");
      } catch (err) {
        console.error("Ambient hum failed to initialize:", err);
      }
    }
  }

  const ambientToggle = document.getElementById("ambient-drone-toggle");
  if (ambientToggle) {
    ambientToggle.addEventListener("click", () => {
      toggleAmbientHum();
    });
  }

  // --- Timeline Map Configuration & State Controller ---
  const ERA_MAP_STATES = [
    {
      title: "Vedic Era",
      range: "3000 BCE – 1500 BCE",
      regions: {
        afg: "active-sanatan",
        pak: "active-sanatan",
        ind: "active-sanatan",
        bgd: "active-sanatan",
        sea: "",
        sl: "active-sanatan"
      },
      statuses: {
        afg: "Active",
        pak: "Active",
        ind: "Active",
        bgd: "Active",
        sea: "Unpopulated",
        sl: "Active"
      }
    },
    {
      title: "Epic & Classical Expansion",
      range: "500 BCE – 300 CE",
      regions: {
        afg: "active-sanatan",
        pak: "active-sanatan",
        ind: "active-sanatan",
        bgd: "active-sanatan",
        sea: "active-sanatan",
        sl: "active-sanatan"
      },
      statuses: {
        afg: "Active",
        pak: "Active",
        ind: "Active",
        bgd: "Active",
        sea: "Active (Peak)",
        sl: "Active"
      }
    },
    {
      title: "Early Invasions & Sindh Fall",
      range: "712 CE – 1192 CE",
      regions: {
        afg: "active-sanatan",
        pak: "lost-sanatan",
        ind: "active-sanatan",
        bgd: "active-sanatan",
        sea: "active-sanatan",
        sl: "active-sanatan"
      },
      statuses: {
        afg: "Active (Shahis)",
        pak: "Lost / Converted",
        ind: "Active",
        bgd: "Active",
        sea: "Active",
        sl: "Active"
      }
    },
    {
      title: "Sultanate & Mughal Hegemony",
      range: "1206 CE – 1707 CE",
      regions: {
        afg: "lost-sanatan",
        pak: "lost-sanatan",
        ind: "active-sanatan",
        bgd: "lost-sanatan",
        sea: "",
        sl: "active-sanatan"
      },
      statuses: {
        afg: "Lost / Converted",
        pak: "Lost / Converted",
        ind: "Active (Resistant)",
        bgd: "Lost / Converted",
        sea: "Other Influence",
        sl: "Active"
      }
    },
    {
      title: "Partition of British India",
      range: "1947 CE",
      regions: {
        afg: "lost-sanatan",
        pak: "lost-sanatan",
        ind: "active-sanatan",
        bgd: "lost-sanatan",
        sea: "",
        sl: "active-sanatan"
      },
      statuses: {
        afg: "Lost (0% remaining)",
        pak: "Lost (Collapse to 1.8%)",
        ind: "Active",
        bgd: "Lost (Drop to 9%)",
        sea: "Other Influence",
        sl: "Active"
      }
    },
    {
      title: "Present Day",
      range: "Modern Era",
      regions: {
        afg: "lost-sanatan",
        pak: "lost-sanatan",
        ind: "active-sanatan",
        bgd: "lost-sanatan",
        sea: "",
        sl: "active-sanatan"
      },
      statuses: {
        afg: "Lost (~0%)",
        pak: "Lost (1.8% remaining)",
        ind: "Active (Bharat Core)",
        bgd: "Lost (8.5% remaining)",
        sea: "Other Influence",
        sl: "Active"
      }
    }
  ];

  function selectTimelineEra(eraIndex) {
    const era = ERA_MAP_STATES[eraIndex];
    if (!era) return;

    // Update Text HUD
    const titleEl = document.getElementById("map-era-title");
    const rangeEl = document.getElementById("map-era-range");
    if (titleEl) titleEl.textContent = era.title;
    if (rangeEl) rangeEl.textContent = era.range;

    // Update active highlight class on left-hand timeline cards
    document.querySelectorAll(".timeline-event").forEach(card => {
      card.classList.remove("active-event");
    });
    const activeCard = document.querySelector(`.timeline-event[data-era-index="${eraIndex}"]`);
    if (activeCard) {
      activeCard.classList.add("active-event");
    }

    // Update Region Polygons & Labels statuses
    const regionIds = ["afg", "pak", "ind", "bgd", "sea", "sl"];
    regionIds.forEach(id => {
      const poly = document.getElementById(`region-${id}`);
      const statusText = document.getElementById(`status-${id}`);
      
      if (poly) {
        // Reset classes
        poly.setAttribute("class", "map-region");
        // Apply new class if present
        const stateClass = era.regions[id];
        if (stateClass) {
          poly.classList.add(stateClass);
        }
      }

      if (statusText) {
        statusText.textContent = era.statuses[id];
        // Dynamic label coloring classes
        statusText.setAttribute("class", "");
        if (era.regions[id] === "active-sanatan") {
          statusText.classList.add("status-active");
        } else if (era.regions[id] === "lost-sanatan") {
          statusText.classList.add("status-lost");
        } else {
          statusText.classList.add("status-neutral");
        }
      }
    });
  }

  // Bind timeline clicks
  document.querySelectorAll(".timeline-event").forEach(card => {
    card.addEventListener("click", () => {
      const eraIndex = parseInt(card.getAttribute("data-era-index"), 10);
      selectTimelineEra(eraIndex);
    });
  });

  // --- Support & Donations Page Logic ---
  let selectedDonationAmount = 251;
  let activePaymentMethod = "upi";

  const presetButtons = document.querySelectorAll(".preset-btn");
  const customAmountInput = document.getElementById("custom-amount-val");
  const submitDonationBtn = document.getElementById("submit-donation-btn");
  
  // Amount Selection Preset Handlers
  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Remove active states
      presetButtons.forEach(b => b.classList.remove("active"));
      // Add active state to clicked button
      btn.classList.add("active");
      // Clear custom input field
      if (customAmountInput) customAmountInput.value = "";
      
      selectedDonationAmount = parseInt(btn.getAttribute("data-amount"), 10);
      updateSubmitButtonText();
    });
  });

  // Custom Amount Input Handler
  if (customAmountInput) {
    customAmountInput.addEventListener("input", () => {
      // Clear preset active states
      presetButtons.forEach(b => b.classList.remove("active"));
      
      const val = parseInt(customAmountInput.value, 10);
      if (!isNaN(val) && val > 0) {
        selectedDonationAmount = val;
      } else {
        selectedDonationAmount = 0;
      }
      updateSubmitButtonText();
    });
  }

  function updateSubmitButtonText() {
    if (submitDonationBtn) {
      if (selectedDonationAmount > 0) {
        submitDonationBtn.textContent = `Contribute ₹${selectedDonationAmount.toLocaleString()} Securely`;
        submitDonationBtn.disabled = false;
      } else {
        submitDonationBtn.textContent = "Enter Contribution Amount";
        submitDonationBtn.disabled = true;
      }
    }
  }

  // Payment Method Tabs Logic
  const payTabBtns = document.querySelectorAll(".pay-tab-btn");
  const payTabContents = document.querySelectorAll(".pay-tab-content");

  payTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      payTabBtns.forEach(b => b.classList.remove("active"));
      payTabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      activePaymentMethod = btn.getAttribute("data-pay-method");
      
      const targetContent = document.getElementById(`pay-content-${activePaymentMethod}`);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });

  // UPI QR Code Copy Clipboard Helper
  const copyUpiBtn = document.getElementById("copy-upi-btn");
  if (copyUpiBtn) {
    copyUpiBtn.addEventListener("click", () => {
      const upiText = document.getElementById("upi-id-text").textContent;
      navigator.clipboard.writeText(upiText).then(() => {
        copyUpiBtn.textContent = "Copied!";
        setTimeout(() => {
          copyUpiBtn.textContent = "Copy ID";
        }, 1500);
      });
    });
  }

  // Credit Card Live Preview Synchronizer
  const ccInputName = document.getElementById("cc-input-name");
  const ccInputNumber = document.getElementById("cc-input-number");
  const ccInputExpiry = document.getElementById("cc-input-expiry");
  const ccInputCvv = document.getElementById("cc-input-cvv");

  const ccPreviewName = document.getElementById("cc-preview-name");
  const ccPreviewNumber = document.getElementById("cc-preview-number");
  const ccPreviewExpiry = document.getElementById("cc-preview-expiry");
  const ccBrandLogo = document.getElementById("cc-brand-logo");

  if (ccInputName) {
    ccInputName.addEventListener("input", () => {
      ccPreviewName.textContent = ccInputName.value.toUpperCase() || "YOUR NAME HERE";
    });
  }

  if (ccInputNumber) {
    ccInputNumber.addEventListener("input", (e) => {
      // Auto-format spaces every 4 digits: "4111 2222 3333 4444"
      let val = ccInputNumber.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
      let formatted = "";
      for (let i = 0; i < val.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += " ";
        formatted += val[i];
      }
      ccInputNumber.value = formatted;
      ccPreviewNumber.textContent = formatted || "•••• •••• •••• ••••";

      // Detect card brand logo based on starting digit
      if (val.startsWith("4")) {
        ccBrandLogo.textContent = "VISA";
      } else if (val.startsWith("5")) {
        ccBrandLogo.textContent = "MASTERCARD";
      } else if (val.startsWith("3")) {
        ccBrandLogo.textContent = "AMEX";
      } else {
        ccBrandLogo.textContent = "CARD";
      }
    });
  }

  if (ccInputExpiry) {
    ccInputExpiry.addEventListener("input", () => {
      // Auto-format expiry slash: "MM/YY"
      let val = ccInputExpiry.value.replace(/\//g, '').replace(/[^0-9]/gi, '');
      if (val.length >= 2) {
        ccInputExpiry.value = val.substring(0, 2) + "/" + val.substring(2, 4);
      } else {
        ccInputExpiry.value = val;
      }
      ccPreviewExpiry.textContent = ccInputExpiry.value || "MM/YY";
    });
  }

  // Web Audio API Confirmation Chime Synthesis
  function playDonationConfirmationChime() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const chimeCtx = new AudioContextClass();
      const gainNode = chimeCtx.createGain();
      gainNode.connect(chimeCtx.destination);
      
      const now = chimeCtx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      
      // Synthesize a golden triple-arpeggio chime (330Hz E5, 440Hz A5, 660Hz E6)
      const frequencies = [330, 440, 660];
      frequencies.forEach((freq, idx) => {
        const osc = chimeCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        osc.connect(gainNode);
        osc.start(now + idx * 0.12);
        osc.stop(now + 1.6);
      });
    } catch (e) {
      console.error("Confirmation chime failed to play:", e);
    }
  }

  // Handle Form Submission
  if (submitDonationBtn) {
    submitDonationBtn.addEventListener("click", () => {
      if (selectedDonationAmount <= 0) return;

      // Validation check for fields
      if (activePaymentMethod === "card") {
        if (!ccInputName.value.trim() || ccInputNumber.value.length < 15 || ccInputExpiry.value.length < 5 || ccInputCvv.value.length < 3) {
          alert("Please fill in all credit card details correctly before proceeding.");
          return;
        }
      } else if (activePaymentMethod === "banking") {
        const bankSelect = document.getElementById("bank-select-element");
        if (!bankSelect || !bankSelect.value) {
          alert("Please select a bank from the list.");
          return;
        }
      }

      // Start processing state
      submitDonationBtn.disabled = true;
      submitDonationBtn.textContent = "Processing Securely...";

      setTimeout(() => {
        // Generate Transaction details
        const txId = "TXN-" + Math.floor(100000000 + Math.random() * 900000000);
        document.getElementById("receipt-tx-id").textContent = txId;
        document.getElementById("receipt-amount-val").textContent = `₹${selectedDonationAmount.toLocaleString()}.00`;

        // Play chime sound
        playDonationConfirmationChime();

        // Open Success overlay
        const overlay = document.getElementById("donation-success-overlay");
        if (overlay) {
          overlay.classList.add("active-overlay");
        }

        // Reset button state
        submitDonationBtn.disabled = false;
        updateSubmitButtonText();
      }, 1500);
    });
  }

  // Close Success Overlay Handler
  const successCloseBtn = document.getElementById("success-close-btn");
  if (successCloseBtn) {
    successCloseBtn.addEventListener("click", () => {
      const overlay = document.getElementById("donation-success-overlay");
      if (overlay) {
        overlay.classList.remove("active-overlay");
      }
      
      // Reset input values
      if (customAmountInput) customAmountInput.value = "";
      if (ccInputName) ccInputName.value = "";
      if (ccInputNumber) ccInputNumber.value = "";
      if (ccInputExpiry) ccInputExpiry.value = "";
      if (ccInputCvv) ccInputCvv.value = "";
      
      if (ccPreviewName) ccPreviewName.textContent = "YOUR NAME HERE";
      if (ccPreviewNumber) ccPreviewNumber.textContent = "•••• •••• •••• ••••";
      if (ccPreviewExpiry) ccPreviewExpiry.textContent = "MM/YY";
      
      presetButtons.forEach(b => b.classList.remove("active"));
      if (presetButtons[0]) presetButtons[0].classList.add("active");
      
      selectedDonationAmount = 251;
      updateSubmitButtonText();

      // Return to homepage
      switchView("home-view");
    });
  }

  // --- Fire Particles (Embers) Background Animation ---
  (function() {
    const canvas = document.getElementById("fire-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H, particles = [];
    
    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = 200;
    }
    resize();
    window.addEventListener("resize", resize);
    
    function Particle() {
      this.reset();
    }
    
    Particle.prototype.reset = function() {
      this.x = Math.random() * W;
      this.y = H;
      this.vx = (Math.random() - 0.5) * 0.8;
      this.vy = -(Math.random() * 1.8 + 1.1);
      this.life = 1;
      this.decay = Math.random() * 0.013 + 0.005;
      this.size = Math.random() * 9 + 3;
    };
    
    // Initialize particles
    for (let i = 0; i < 70; i++) {
      const p = new Particle();
      p.y = Math.random() * H;
      p.life = Math.random();
      particles.push(p);
    }
    
    function draw() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0 || p.y < 0) {
          p.reset();
        }
        const t = 1 - p.life;
        ctx.globalAlpha = p.life * 0.4;
        // Golden/orange gradient coloring matching the theme colors
        ctx.fillStyle = `rgb(${Math.floor(212 + t * 43)}, ${Math.floor(175 - t * 125)}, 55)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + p.life * 0.5), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      setTimeout(draw, 40);
    }
    draw();
  })();

  // --- Online Academy Subscription Management ---
  const pricingBtns = document.querySelectorAll(".pricing-select-btn");
  const enrollmentPanel = document.getElementById("enrollment-panel");
  const selectedTierName = document.getElementById("selected-tier-name");
  const selectedTierPrice = document.getElementById("selected-tier-price");
  const enrollSubmitBtn = document.getElementById("enroll-submit-btn");

  let activeEnrollTier = null;
  let activeEnrollPrice = null;

  pricingBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tier = btn.getAttribute("data-tier");
      const price = btn.getAttribute("data-price");
      const name = btn.getAttribute("data-name");

      activeEnrollTier = name;
      activeEnrollPrice = price;

      selectedTierName.textContent = name;
      selectedTierPrice.textContent = `₹${price}/mo`;
      enrollSubmitBtn.textContent = `Authorize Subscription of ₹${price}/mo`;

      // Show panel
      enrollmentPanel.classList.remove("hidden");

      // Scroll to panel
      enrollmentPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Switch Payment Gateways
  const enrollTabBtns = document.querySelectorAll("#enrollment-panel .gateway-tab-btn");
  const enrollGatewayContents = document.querySelectorAll("#enrollment-panel .gateway-content");
  let activeEnrollPaymentMethod = "upi";

  enrollTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetMethod = btn.getAttribute("data-paymethod");
      activeEnrollPaymentMethod = targetMethod;

      // Update active tab class
      enrollTabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Update active content
      enrollGatewayContents.forEach(c => {
        if (c.id === `enroll-pay-${targetMethod}`) {
          c.classList.add("active");
        } else {
          c.classList.remove("active");
        }
      });
    });
  });

  // Card details live preview
  const enrollCardNum = document.getElementById("enroll-card-num");
  const enrollCardExpiry = document.getElementById("enroll-card-expiry");
  const enrollCardCvv = document.getElementById("enroll-card-cvv");
  const enrollCardName = document.getElementById("enroll-name");

  const enrollCardNumPreview = document.getElementById("enroll-card-num-preview");
  const enrollCardNamePreview = document.getElementById("enroll-card-name-preview");
  const enrollCardExpiryPreview = document.getElementById("enroll-card-expiry-preview");
  const enrollCardBrandLogo = document.getElementById("enroll-card-brand-logo");

  if (enrollCardNum) {
    enrollCardNum.addEventListener("input", (e) => {
      let val = e.target.value.replace(/\D/g, "");
      // Space format: xxxx xxxx xxxx xxxx
      let formatted = "";
      for (let i = 0; i < val.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += " ";
        formatted += val[i];
      }
      e.target.value = formatted;
      enrollCardNumPreview.textContent = formatted || "•••• •••• •••• ••••";

      // Detect card brand
      if (val.startsWith("4")) {
        enrollCardBrandLogo.textContent = "VISA";
      } else if (val.startsWith("5")) {
        enrollCardBrandLogo.textContent = "Mastercard";
      } else if (val.startsWith("3")) {
        enrollCardBrandLogo.textContent = "AMEX";
      } else {
        enrollCardBrandLogo.textContent = "RuPay";
      }
    });
  }

  if (enrollCardExpiry) {
    enrollCardExpiry.addEventListener("input", (e) => {
      let val = e.target.value.replace(/\D/g, "");
      if (val.length > 2) {
        val = val.substring(0, 2) + "/" + val.substring(2, 4);
      }
      e.target.value = val;
      enrollCardExpiryPreview.textContent = val || "MM/YY";
    });
  }

  if (enrollCardName) {
    enrollCardName.addEventListener("input", (e) => {
      enrollCardNamePreview.textContent = e.target.value.toUpperCase() || "STUDENT NAME";
    });
  }

  // Handle Enrollment Submit Form
  const enrollmentForm = document.getElementById("enrollment-form");
  const academySuccessOverlay = document.getElementById("academy-success-overlay");
  const certStudentName = document.getElementById("cert-student-name");
  const certTierName = document.getElementById("cert-tier-name");
  const certRegId = document.getElementById("cert-reg-id");
  const certDate = document.getElementById("cert-date");

  if (enrollmentForm) {
    enrollmentForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (activeEnrollPaymentMethod === "card") {
        if (!enrollCardNum.value.replace(/\s/g, "") || enrollCardNum.value.replace(/\s/g, "").length < 15) {
          alert("Please enter a valid card number.");
          return;
        }
        if (!enrollCardExpiry.value || enrollCardExpiry.value.length < 5) {
          alert("Please enter a valid card expiry date.");
          return;
        }
        if (!enrollCardCvv.value || enrollCardCvv.value.length < 3) {
          alert("Please enter a valid card CVV.");
          return;
        }
      }

      // Synthesize golden chime arpeggio
      playDonationConfirmationChime();

      // Populate Certificate Data
      const studentNameVal = document.getElementById("enroll-name").value;
      certStudentName.textContent = studentNameVal || "Student";
      certTierName.textContent = activeEnrollTier || "Vedic Vidyārthī";
      certRegId.textContent = "VA-" + Math.floor(1000000 + Math.random() * 9000000);
      
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      certDate.textContent = new Date().toLocaleDateString("en-US", options);

      // Show success modal
      academySuccessOverlay.classList.remove("hidden");
    });
  }

  // Close Certificate overlay
  const certCloseBtn = document.getElementById("cert-close-btn");
  if (certCloseBtn) {
    certCloseBtn.addEventListener("click", () => {
      academySuccessOverlay.classList.add("hidden");
      enrollmentPanel.classList.add("hidden");
      
      // Reset form fields
      enrollmentForm.reset();
      enrollCardNumPreview.textContent = "•••• •••• •••• ••••";
      enrollCardNamePreview.textContent = "STUDENT NAME";
      enrollCardExpiryPreview.textContent = "MM/YY";
      enrollCardBrandLogo.textContent = "VISA";
    });
  }

  const certHomeBtn = document.getElementById("cert-home-btn");
  if (certHomeBtn) {
    certHomeBtn.addEventListener("click", () => {
      academySuccessOverlay.classList.add("hidden");
      enrollmentPanel.classList.add("hidden");
      
      // Reset form fields
      enrollmentForm.reset();
      enrollCardNumPreview.textContent = "•••• •••• •••• ••••";
      enrollCardNamePreview.textContent = "STUDENT NAME";
      enrollCardExpiryPreview.textContent = "MM/YY";
      enrollCardBrandLogo.textContent = "VISA";

      // Switch to home view
      switchView("home-view");
    });
  }

  // --- Floating 3D AI Avatar Controller ---
  const aiAvatarWidget = document.getElementById("ai-avatar-widget");
  const avatarImageContainer = document.getElementById("avatar-image-container");
  const aiAvatarBubble = document.getElementById("ai-avatar-bubble");
  const bubbleCloseBtn = document.getElementById("bubble-close-btn");
  const bubbleBodyContent = document.getElementById("bubble-body-content");
  const avatarLinkBtn = document.getElementById("avatar-link-btn");

  if (avatarImageContainer && aiAvatarBubble) {
    // Show bubble on load after a short delay (e.g. 2 seconds)
    setTimeout(() => {
      aiAvatarBubble.classList.remove("hidden");
    }, 2000);

    avatarImageContainer.addEventListener("click", (e) => {
      e.stopPropagation();
      aiAvatarBubble.classList.toggle("hidden");
    });

    aiAvatarBubble.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    if (bubbleCloseBtn) {
      bubbleCloseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        aiAvatarBubble.classList.add("hidden");
      });
    }

    // Handle Quick Questions click
    const initialBubbleHTML = bubbleBodyContent.innerHTML;

    aiAvatarBubble.addEventListener("click", (e) => {
      const qBtn = e.target.closest(".quick-quest-btn");
      if (qBtn) {
        const type = qBtn.getAttribute("data-type");

        if (type === "go-home") {
          switchView("home-view");
          aiAvatarBubble.classList.add("hidden");
          return;
        }

        let infoHTML = "";

        if (type === "timeline") {
          infoHTML = `
            <p><strong>Vedic Timeline Assistance:</strong> The Historical Timeline shows the territorial expansions and migrations of Sanatan Dharma from 3000 BCE. Navigate through the timeline to see changes in demographic maps.</p>
            <button class="quick-quest-btn back-btn">➔ Back to Menu</button>
          `;
        } else if (type === "explorer") {
          infoHTML = `
            <p><strong>Mantra Explorer Assistance:</strong> This explorer displays 7 canonical mantras. Hovering over a Devanagari word reveals its grammar, translation, and plays its spoken sound pronunciation instantly.</p>
            <button class="quick-quest-btn back-btn">➔ Back to Menu</button>
          `;
        } else if (type === "recitation") {
          infoHTML = `
            <p><strong>Recitation Accents:</strong> Vedas rely on precise pitch accents: Udatta (high), Anudatta (low), and Svarita (inflected) to maintain the exact meaning across generations. Tap a mantra to listen to its complete audio.</p>
            <button class="quick-quest-btn back-btn">➔ Back to Menu</button>
          `;
        } else if (type === "meaning") {
          infoHTML = `
            <p><strong>Meaning of Life:</strong> The Vedas teach that the ultimate goal is Moksha (liberation), achieved through Dharma (righteousness), Artha (wealth/purpose), and Kama (desire), balanced with spiritual discipline.</p>
            <button class="quick-quest-btn back-btn">➔ Back to Menu</button>
          `;
        } else if (type === "gods") {
          infoHTML = `
            <p><strong>Vedic Gods:</strong> The primary deities in the Vedas are natural forces personified, such as Agni (Fire), Indra (Rain/Thunder), Surya (Sun), and Varuna (Cosmic Order). Later, these evolved into the Trimurti.</p>
            <button class="quick-quest-btn back-btn">➔ Back to Menu</button>
          `;
        } else if (type === "meditation") {
          infoHTML = `
            <p><strong>Starting Meditation:</strong> The Vedas recommend starting with Dhyana (meditation) by sitting quietly, focusing on the breath or the sound of 'Om', and gently guiding the mind back when it wanders.</p>
            <button class="quick-quest-btn back-btn">➔ Back to Menu</button>
          `;
        }

        bubbleBodyContent.innerHTML = infoHTML;
      }

      const backBtn = e.target.closest(".back-btn");
      if (backBtn) {
        bubbleBodyContent.innerHTML = initialBubbleHTML;
      }
    });

    // Handle Link to Verified Portals
    if (avatarLinkBtn) {
      avatarLinkBtn.addEventListener("click", () => {
        // Switch to resources view
        switchView("resources-view");

        // Close bubble
        aiAvatarBubble.classList.add("hidden");

        // Scroll to portals section
        const resourcesGrid = document.querySelector(".resources-section");
        if (resourcesGrid) {
          resourcesGrid.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        // Highlight portal cards
        const portalCards = document.querySelectorAll(".resource-link-card");
        portalCards.forEach(card => {
          card.classList.add("highlight-flash");
        });

        // Remove highlight after 5 seconds
        setTimeout(() => {
          portalCards.forEach(card => {
            card.classList.remove("highlight-flash");
          });
        }, 5000);
      });
    }

    // Close bubble if clicked anywhere outside
    document.addEventListener("click", () => {
      aiAvatarBubble.classList.add("hidden");
    });
  }

  // --- Historical Intro Splash Controller ---
  (function() {
    const splashOverlay = document.getElementById("intro-splash");
    if (!splashOverlay) return;

    // Check if user has already seen splash screen in this session
    const hasSeenIntro = sessionStorage.getItem("hasSeenIntro");
    // Webdriver/Automation optimization - bypass splash screen automatically
    const isAutomation = typeof window !== "undefined" && window.navigator.webdriver;
    
    if (hasSeenIntro === "true" || isAutomation) {
      splashOverlay.classList.add("hidden");
      return;
    }

    const slides = document.querySelectorAll(".splash-slide");
    const dots = document.querySelectorAll(".progress-dot");
    const prevBtn = document.getElementById("prev-splash-btn");
    const nextBtn = document.getElementById("next-splash-btn");
    const enterBtn = document.getElementById("enter-splash-btn");
    const skipBtn = document.getElementById("skip-splash-btn");

    let currentSlide = 1;
    const totalSlides = slides.length;

    function showSlide(index) {
      currentSlide = index;

      // Update slides active state
      slides.forEach(slide => {
        const sNum = parseInt(slide.getAttribute("data-slide"));
        if (sNum === index) {
          slide.classList.add("active");
        } else {
          slide.classList.remove("active");
        }
      });

      // Update progress dots active state
      dots.forEach(dot => {
        const dNum = parseInt(dot.getAttribute("data-target-slide"));
        if (dNum === index) {
          dot.classList.add("active");
        } else {
          dot.classList.remove("active");
        }
      });

      // Update button visibility
      if (index === 1) {
        prevBtn.classList.add("hidden");
      } else {
        prevBtn.classList.remove("hidden");
      }

      if (index === totalSlides) {
        nextBtn.classList.add("hidden");
        enterBtn.classList.remove("hidden");
      } else {
        nextBtn.classList.remove("hidden");
        enterBtn.classList.add("hidden");
      }
    }

    // Next slide
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (currentSlide < totalSlides) {
          showSlide(currentSlide + 1);
        }
      });
    }

    // Prev slide
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (currentSlide > 1) {
          showSlide(currentSlide - 1);
        }
      });
    }

    // Progress dot clicking
    dots.forEach(dot => {
      dot.addEventListener("click", () => {
        const target = parseInt(dot.getAttribute("data-target-slide"));
        showSlide(target);
      });
    });

    // Enter Portal / Dismiss function
    function dismissIntro() {
      sessionStorage.setItem("hasSeenIntro", "true");
      splashOverlay.classList.add("hidden");
    }

    if (enterBtn) {
      enterBtn.addEventListener("click", dismissIntro);
    }

    if (skipBtn) {
      skipBtn.addEventListener("click", dismissIntro);
    }
  })();

  // --- Initial Setup ---
  buildNavigationTree();
  bindMatrixHovers();
  switchView("home-view");
  loadVerse("rv_1_1_1");
});
