// बाल हिंदी वाटिका - Application Script

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let starsCount = 0;
    let badgesCount = 0;
    let completedActivities = {
        dragVocab: new Set(),
        mcqVocab: new Set(),
        oralQuiz: new Set(),
        poetryBlanks: false,
        sandboxSentences: new Set()
    };

    // DOM Elements
    const starCountEl = document.getElementById('star-count');
    const badgeCountEl = document.getElementById('badge-count');

    // Update Stars and Badges UI
    function addStars(count) {
        starsCount += count;
        starCountEl.textContent = starsCount;
        starCountEl.parentElement.classList.add('scale-pop');
        setTimeout(() => starCountEl.parentElement.classList.remove('scale-pop'), 300);
        triggerConfetti(count * 5); // Confetti burst size depends on stars earned
    }

    function addBadge() {
        badgesCount += 1;
        badgeCountEl.textContent = badgesCount;
        badgeCountEl.parentElement.classList.add('scale-pop');
        setTimeout(() => badgeCountEl.parentElement.classList.remove('scale-pop'), 300);
    }

    // --- TAB SYSTEM ---
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            navButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
            
            // Speak tab switch
            speakText(`अध्याय ${btn.textContent.trim()}`);
        });
    });


    // --- TEXT-TO-SPEECH (TTS) SYSTEM ---
    const speedSelect = document.getElementById('tts-speed');
    let voices = [];
    let audioPlay = new Audio(); // HTML5 audio element for Google TTS

    function loadVoices() {
        if (!('speechSynthesis' in window)) return;
        voices = window.speechSynthesis.getVoices();
    }

    // Initialize voices for native fallback
    loadVoices();
    if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    function speakText(text) {
        // Clean text (remove formatting and punctuation characters)
        const cleanText = text.replace(/[.,?/#!$%^&*;:{}=\-_`~()|]/g, "").trim();
        if (!cleanText) return;

        // Cancel any native speech synthesis currently playing
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        // Try playing via local proxy API (prevents CORS and Referrer Policy blocks)
        const encodedText = encodeURIComponent(cleanText);
        const ttsUrl = `/api/tts?text=${encodedText}`;

        audioPlay.pause();
        audioPlay.src = ttsUrl;
        
        // Adjust playback speed on audio element based on user selection
        const speed = parseFloat(speedSelect.value) || 0.9;
        audioPlay.defaultPlaybackRate = speed;
        audioPlay.playbackRate = speed;

        audioPlay.play()
            .then(() => {
                // Audio played successfully, make sure any warning is hidden
                const voiceWarningEl = document.getElementById('voice-warning');
                if (voiceWarningEl) voiceWarningEl.style.display = 'none';
            })
            .catch(err => {
                console.warn("Google TTS online failed (possibly offline). Falling back to browser SpeechSynthesis.", err);
                speakTextNative(cleanText);
            });
    }

    function speakTextNative(text) {
        if (!('speechSynthesis' in window)) return;

        // Resume speech engine (workaround for Chrome bug)
        window.speechSynthesis.resume();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'hi-IN';
        
        const speed = parseFloat(speedSelect.value) || 0.9;
        utterance.rate = speed;

        if (voices.length === 0) {
            loadVoices();
        }

        let hindiVoice = voices.find(v => v.lang === 'hi-IN');
        if (!hindiVoice) {
            hindiVoice = voices.find(v => v.lang.startsWith('hi') || v.lang.includes('Hindi'));
        }

        const voiceWarningEl = document.getElementById('voice-warning');
        if (hindiVoice) {
            utterance.voice = hindiVoice;
            if (voiceWarningEl) voiceWarningEl.style.display = 'none';
        } else {
            console.warn("No Hindi voice pack found on this system.");
            if (voiceWarningEl) {
                voiceWarningEl.textContent = "⚠️ इंटरनेट कनेक्शन या हिंदी आवाज़ अनुपलब्ध है।";
                voiceWarningEl.style.display = 'block';
            }
        }

        // Delay speak slightly to bypass Chrome cancel-state locks
        setTimeout(() => {
            window.speechSynthesis.speak(utterance);
        }, 50);
    }

    // Interactive Poem Reader Clicking logic
    const poemLines = document.querySelectorAll('.poem-line');
    const poemWords = document.querySelectorAll('.word');

    // Click line to read entire line
    poemLines.forEach(line => {
        line.addEventListener('click', (e) => {
            // Prevent event bubbling if word is clicked
            if (e.target.classList.contains('word')) return;
            
            const textToSpeak = line.getAttribute('data-line');
            line.classList.add('scale-pop');
            setTimeout(() => line.classList.remove('scale-pop'), 200);
            speakText(textToSpeak);
        });
    });

    // Click word to read individual word
    poemWords.forEach(word => {
        word.addEventListener('click', (e) => {
            e.stopPropagation();
            const textToSpeak = word.textContent.replace(/[.,?/#!$%^&*;:{}=\-_`~()]/g,"");
            word.classList.add('scale-pop');
            setTimeout(() => word.classList.remove('scale-pop'), 150);
            speakText(textToSpeak);
        });
    });

    // Interactive Dictionary Card Clicking logic
    const meaningCards = document.querySelectorAll('.meaning-card');
    meaningCards.forEach(card => {
        card.addEventListener('click', () => {
            const isRevealed = card.classList.contains('revealed');
            
            // Toggle reveal state
            card.classList.toggle('revealed');
            
            const word = card.getAttribute('data-word');
            const meaning = card.getAttribute('data-meaning');
            
            if (!isRevealed) {
                // If revealing, speak word + meaning
                speakText(`${word}. मतलब: ${meaning}`);
            } else {
                // If collapsing, speak word
                speakText(word);
            }
        });
    });


    // --- VOCAB GAME 1: ANTONYM MATCHER (DRAG & DROP) ---
    const prefixA = document.getElementById('prefix-a');
    const dropZones = document.querySelectorAll('.vocab-grid .drop-zone');
    const resetDragBtn = document.getElementById('reset-drag-game');

    // Drag events
    prefixA.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', 'prefix-a');
        prefixA.style.opacity = '0.5';
    });

    prefixA.addEventListener('dragend', () => {
        prefixA.style.opacity = '1';
    });

    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!zone.classList.contains('matched')) {
                zone.classList.add('dragover');
            }
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');

            if (zone.classList.contains('matched')) return;

            const card = zone.closest('.target-card');
            const baseWord = card.getAttribute('data-base');
            const correctWord = card.getAttribute('data-correct');

            // Success Match
            zone.classList.add('matched');
            zone.textContent = 'अ';
            
            const resultSpan = card.querySelector('.result-word');
            resultSpan.textContent = correctWord;
            card.classList.add('success-match');

            completedActivities.dragVocab.add(baseWord);
            
            // Earn Stars
            addStars(5);
            
            // Pronunciation of Opposites
            speakText(`${baseWord} का विलोम शब्द है ${correctWord}`);

            // If all matched, play celebration chime
            if (completedActivities.dragVocab.size === dropZones.length) {
                setTimeout(() => {
                    speakText("अति उत्तम! आपने सभी विलोम शब्द पूरे कर लिए हैं!");
                    addBadge();
                }, 1500);
            }
        });
    });

    // Reset Drag Game
    resetDragBtn.addEventListener('click', () => {
        dropZones.forEach(zone => {
            zone.classList.remove('matched');
            zone.textContent = '';
        });

        document.querySelectorAll('.target-card').forEach(card => {
            card.classList.remove('success-match');
            card.querySelector('.result-word').textContent = '?';
        });

        completedActivities.dragVocab.clear();
        speakText("विलोम शब्द खेल दोबारा शुरू हो गया है।");
    });


    // --- VOCAB GAME 2: SYNONYM FINDER (MCQ) ---
    const mcqCards = document.querySelectorAll('.synonym-mcq-card');

    mcqCards.forEach(card => {
        const optionBtns = card.querySelectorAll('.option-btn');
        const feedbackMsg = card.querySelector('.feedback-msg');
        const cardWord = card.getAttribute('data-word');

        optionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const isCorrect = btn.getAttribute('data-correct') === 'true';
                const chosenText = btn.textContent;
                
                // Disable all options on click
                optionBtns.forEach(b => b.disabled = true);

                if (isCorrect) {
                    btn.classList.add('correct');
                    feedbackMsg.textContent = '✓ सही उत्तर! (+५ तारे)';
                    feedbackMsg.className = 'feedback-msg correct';
                    
                    completedActivities.mcqVocab.add(cardWord);
                    addStars(5);
                    speakText(`शाबाश! ${cardWord} का अर्थ ${chosenText} होता है।`);

                    // Check if all MCQs done
                    if (completedActivities.mcqVocab.size === mcqCards.length) {
                        setTimeout(() => {
                            speakText("बधाई हो! आपने पर्यायवाची शब्दों का सारा अभ्यास पूरा कर लिया!");
                            addBadge();
                        }, 2000);
                    }
                } else {
                    btn.classList.add('incorrect');
                    feedbackMsg.textContent = '❌ गलत उत्तर! फिर से कोशिश करें।';
                    feedbackMsg.className = 'feedback-msg incorrect';
                    
                    card.classList.add('shake-animation');
                    speakText(`यह गलत है। क्या आप दोबारा प्रयास करना चाहेंगे?`);
                    
                    setTimeout(() => {
                        card.classList.remove('shake-animation');
                        // Reactivate buttons for retry
                        optionBtns.forEach(b => {
                            b.disabled = false;
                            b.classList.remove('incorrect');
                        });
                        feedbackMsg.textContent = '';
                    }, 1200);
                }
            });
        });
    });


    // --- TAB 3: QUIZ 1 - ORAL QUESTIONS (MAUKHIK) ---
    const quizCards = document.querySelectorAll('.quiz-card');
    const prevQuizBtn = document.getElementById('prev-oral');
    const nextQuizBtn = document.getElementById('next-oral');
    const oralDots = document.querySelectorAll('#oral-progress .dot');
    let currentQuizIndex = 0;

    function updateQuizCarousel() {
        quizCards.forEach((card, idx) => {
            card.classList.toggle('active', idx === currentQuizIndex);
            oralDots[idx].classList.toggle('active', idx === currentQuizIndex);
        });

        prevQuizBtn.disabled = currentQuizIndex === 0;
        nextQuizBtn.disabled = currentQuizIndex === quizCards.length - 1;

        // Speak current question when opening
        const activeCard = quizCards[currentQuizIndex];
        const questionText = activeCard.querySelector('.quiz-question-text').textContent;
        speakText(questionText);
    }

    prevQuizBtn.addEventListener('click', () => {
        if (currentQuizIndex > 0) {
            currentQuizIndex--;
            updateQuizCarousel();
        }
    });

    nextQuizBtn.addEventListener('click', () => {
        if (currentQuizIndex < quizCards.length - 1) {
            currentQuizIndex++;
            updateQuizCarousel();
        }
    });

    // Check oral quiz submissions
    const quizSubmissions = document.querySelectorAll('.quiz-card');
    quizSubmissions.forEach((card, index) => {
        const textInput = card.querySelector('.quiz-text-input');
        const submitBtn = card.querySelector('.submit-answer-btn');
        const feedback = card.querySelector('.quiz-feedback');
        const correctKeys = card.getAttribute('data-correct-keys').split(',');

        submitBtn.addEventListener('click', () => {
            const userAns = textInput.value.trim().toLowerCase();
            if (userAns === '') {
                speakText("कृपया अपना उत्तर लिखें या माइक का बटन दबाकर बोलें।");
                return;
            }

            // Check match (e.g. contains any expected words)
            const isMatch = correctKeys.some(key => userAns.includes(key.toLowerCase()));

            if (isMatch) {
                feedback.textContent = '🎉 बिल्कुल सही उत्तर! (+१० तारे)';
                feedback.className = 'quiz-feedback correct';
                submitBtn.disabled = true;
                textInput.disabled = true;
                
                oralDots[index].classList.add('correct');
                completedActivities.oralQuiz.add(index);
                
                addStars(10);
                speakText("अति सुंदर! आपका उत्तर सही है।");

                if (completedActivities.oralQuiz.size === quizCards.length) {
                    setTimeout(() => {
                        speakText("बहुत बढ़िया! आपने सभी मौखिक प्रश्नों के उत्तर दे दिए हैं!");
                        addBadge();
                    }, 2000);
                }
            } else {
                feedback.textContent = '😢 सही उत्तर नहीं है। एक बार फिर सोचें!';
                feedback.className = 'quiz-feedback incorrect';
                card.classList.add('shake-animation');
                speakText("उत्तर गलत है। दोबारा प्रयास करें!");
                
                setTimeout(() => {
                    card.classList.remove('shake-animation');
                }, 1000);
            }
        });
    });

    // Speech Recognition (Speech-to-Text) Widget
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const micButtons = document.querySelectorAll('.mic-btn');
        
        micButtons.forEach(btn => {
            const card = btn.closest('.quiz-card');
            const textInput = card.querySelector('.quiz-text-input');
            const statusEl = card.querySelector('.stt-status');
            
            const recognition = new SpeechRecognition();
            recognition.lang = 'hi-IN';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            btn.addEventListener('click', () => {
                if (btn.classList.contains('listening')) {
                    recognition.stop();
                    return;
                }

                btn.classList.add('listening');
                btn.textContent = '🔴 सुन रहा हूँ';
                statusEl.textContent = 'बोलिए, मैं सुन रहा हूँ...';
                textInput.value = '';
                
                recognition.start();
            });

            recognition.onresult = (event) => {
                const speechResult = event.results[0][0].transcript;
                textInput.value = speechResult;
                statusEl.textContent = 'सुना गया!';
            };

            recognition.onspeechend = () => {
                recognition.stop();
            };

            recognition.onerror = (event) => {
                statusEl.textContent = 'त्रुटि! फिर से कोशिश करें।';
                console.error("STT Speech recognition error", event.error);
                recognition.stop();
            };

            recognition.onend = () => {
                btn.classList.remove('listening');
                btn.textContent = '🎙️ बोलें';
                if (statusEl.textContent === 'बोलिए, मैं सुन रहा हूँ...') {
                    statusEl.textContent = 'माइक बंद है';
                }
            };
        });
    } else {
        // Fallback if no Web Speech Recognition support
        document.querySelectorAll('.mic-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        document.querySelectorAll('.stt-status').forEach(status => {
            status.textContent = 'आपके ब्राउज़र में बोलकर लिखने की सुविधा उपलब्ध नहीं है।';
        });
    }


    // --- TAB 3: QUIZ 2 - FILL IN THE BLANKS POETRY ---
    const poetryPool = document.getElementById('poetry-words-pool');
    const poolWords = document.querySelectorAll('.pool-word-card');
    const dropSlots = document.querySelectorAll('.word-drop-slot');
    const verifyPoetryBtn = document.getElementById('verify-poetry-btn');
    const resetPoetryBtn = document.getElementById('reset-poetry-btn');
    const poetryFeedback = document.getElementById('poetry-completion-feedback');

    poolWords.forEach(word => {
        word.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', word.id);
            word.classList.add('dragging');
        });

        word.addEventListener('dragend', () => {
            word.classList.remove('dragging');
        });
    });

    dropSlots.forEach(slot => {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('dragover');
        });

        slot.addEventListener('dragleave', () => {
            slot.classList.remove('dragover');
        });

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('dragover');

            const draggedId = e.dataTransfer.getData('text/plain');
            const draggedElement = document.getElementById(draggedId);

            if (!draggedElement) return;

            // If slot already has a word, return it to the pool
            if (slot.children.length > 0) {
                const existingWord = slot.children[0];
                poetryPool.appendChild(document.getElementById(existingWord.dataset.sourceId));
                slot.innerHTML = '';
            }

            // Move word into the slot
            const placedWord = document.createElement('span');
            placedWord.className = 'word-placed';
            placedWord.textContent = draggedElement.textContent;
            placedWord.dataset.sourceId = draggedId;
            
            // Allow clicking placed word to remove it
            placedWord.addEventListener('click', () => {
                poetryPool.appendChild(draggedElement);
                draggedElement.style.display = 'block';
                slot.removeChild(placedWord);
            });

            slot.appendChild(placedWord);
            draggedElement.style.display = 'none'; // hide in pool
        });
    });

    // Verify Poetry completion
    verifyPoetryBtn.addEventListener('click', () => {
        let allCorrect = true;
        let filledCount = 0;

        dropSlots.forEach(slot => {
            if (slot.children.length === 0) {
                allCorrect = false;
                return;
            }

            filledCount++;
            const placedText = slot.children[0].textContent;
            const expectedText = slot.getAttribute('data-expected');

            if (placedText !== expectedText) {
                allCorrect = false;
                slot.children[0].style.backgroundColor = '#ef4444'; // Red for wrong
            } else {
                slot.children[0].style.backgroundColor = 'var(--secondary-color)'; // Green for right
            }
        });

        if (filledCount < dropSlots.length) {
            poetryFeedback.textContent = '⚠️ कृपया सभी खाली स्थानों को भरें!';
            poetryFeedback.className = 'feedback-msg incorrect';
            speakText("कृपया पहले सभी खाली स्थानों को पूरा भरें।");
            return;
        }

        if (allCorrect) {
            poetryFeedback.textContent = '🎉 अद्भुत! आपने कविता की पंक्तियाँ बिल्कुल सही पूरी की हैं! (+१५ तारे)';
            poetryFeedback.className = 'feedback-msg correct';
            
            // Disable drag/drop interaction once correct
            dropSlots.forEach(slot => {
                if (slot.children.length > 0) {
                    slot.children[0].style.pointerEvents = 'none';
                }
            });
            
            if (!completedActivities.poetryBlanks) {
                completedActivities.poetryBlanks = true;
                addStars(15);
                addBadge();
            }
            speakText("अद्भुत! आपने कविता की पंक्तियाँ बिल्कुल सही पूरी की हैं!");
        } else {
            poetryFeedback.textContent = '❌ कुछ शब्द गलत स्थान पर हैं। दोबारा प्रयास करें!';
            poetryFeedback.className = 'feedback-msg incorrect';
            speakText("कुछ शब्द गलत स्थान पर हैं। दोबारा प्रयास करें!");
        }
    });

    // Reset Poetry game
    resetPoetryBtn.addEventListener('click', () => {
        dropSlots.forEach(slot => {
            if (slot.children.length > 0) {
                const placedWord = slot.children[0];
                const sourceId = placedWord.dataset.sourceId;
                const originalElement = document.getElementById(sourceId);
                if (originalElement) {
                    originalElement.style.display = 'block';
                    poetryPool.appendChild(originalElement);
                }
                slot.innerHTML = '';
            }
        });
        
        poetryFeedback.textContent = '';
        poetryFeedback.className = 'feedback-msg';
        completedActivities.poetryBlanks = false;
        speakText("कविता खेल दोबारा शुरू हो गया है।");
    });


    // --- TAB 4: CREATIVE SANDBOX SENTENCE MAKER ---
    const sandboxCards = document.querySelectorAll('.sandbox-card');

    function validateSandboxCard(card, quietMode = false) {
        const submitBtn = card.querySelector('.verify-sandbox-btn');
        const meaningInput = card.querySelector('.meaning-input');
        const sentenceInput = card.querySelector('.sentence-input');
        const feedback = card.querySelector('.sandbox-feedback-msg');
        const word = card.getAttribute('data-word');
        const expectedMeaning = card.getAttribute('data-expected-meaning');

        const meaning = meaningInput.value.trim().toLowerCase();
        const sentence = sentenceInput.value.trim();

        // 1. Basic validation on meaning (e.g. check if includes keywords)
        const checkMeaning = meaning !== '' && expectedMeaning.split('/').some(m => meaning.includes(m.trim().toLowerCase()));

        // 2. Validate sentence contains the word and is reasonable length (at least 10 characters)
        const sentenceContainsWord = sentence.includes(word);
        const isLongEnough = sentence.length >= 10;
        const isSentenceCorrect = sentence !== '' && sentenceContainsWord && isLongEnough;

        // Apply successful input styling dynamically
        if (checkMeaning) {
            meaningInput.classList.add('input-success');
        } else {
            meaningInput.classList.remove('input-success');
        }

        if (isSentenceCorrect) {
            sentenceInput.classList.add('input-success');
        } else {
            sentenceInput.classList.remove('input-success');
        }

        if (!checkMeaning || !isSentenceCorrect) {
            if (!quietMode) {
                if (meaning === '' || sentence === '') {
                    speakText("कृपया पहले शब्द का अर्थ और वाक्य दोनों लिखें या बोलें।");
                    feedback.textContent = '⚠️ दोनों डिब्बों को भरें!';
                    feedback.className = 'sandbox-feedback-msg incorrect';
                } else if (!checkMeaning) {
                    feedback.textContent = '❌ शब्द का अर्थ सही नहीं लग रहा है। पुनः विचार करें!';
                    feedback.className = 'sandbox-feedback-msg incorrect';
                    speakText("शब्द का अर्थ सही नहीं लग रहा है। इसे ठीक करें।");
                    card.classList.add('shake-animation');
                    setTimeout(() => card.classList.remove('shake-animation'), 1000);
                } else if (!sentenceContainsWord) {
                    feedback.textContent = `❌ वाक्य में शब्द "${word}" का होना ज़रूरी है!`;
                    feedback.className = 'sandbox-feedback-msg incorrect';
                    speakText(`आपके वाक्य में शब्द "${word}" नहीं मिल रहा है।`);
                    card.classList.add('shake-animation');
                    setTimeout(() => card.classList.remove('shake-animation'), 1000);
                } else if (!isLongEnough) {
                    feedback.textContent = '❌ वाक्य थोड़ा बड़ा और सार्थक बनाएँ!';
                    feedback.className = 'sandbox-feedback-msg incorrect';
                    speakText("वाक्य थोड़ा बड़ा और सार्थक बनाएँ!");
                    card.classList.add('shake-animation');
                    setTimeout(() => card.classList.remove('shake-animation'), 1000);
                }
            }
            return false;
        }

        // Success Sandbox Sentence
        feedback.textContent = '⭐ उत्तम वाक्य! आपको पदक और तारे मिलते हैं! (+२० तारे)';
        feedback.className = 'sandbox-feedback-msg correct';
        
        card.classList.add('completed');
        card.querySelector('.badge-status').textContent = '⭐';
        
        submitBtn.disabled = true;
        meaningInput.disabled = true;
        sentenceInput.disabled = true;
        card.querySelectorAll('.sandbox-mic-btn').forEach(btn => btn.disabled = true);
        card.querySelectorAll('.play-word-btn').forEach(btn => btn.disabled = true);

        if (!completedActivities.sandboxSentences.has(word)) {
            completedActivities.sandboxSentences.add(word);
            addStars(20);
            addBadge();
            speakText(`अद्भुत वाक्य है! आपने शब्द ${word} से बहुत प्यारा वाक्य बनाया है।`);
        }

        // If all done
        if (completedActivities.sandboxSentences.size === sandboxCards.length) {
            setTimeout(() => {
                speakText("बधाई हो! आपने भाषा के रचनात्मक कोने का पूरा अभ्यास समाप्त कर लिया! आप एक हिंदी बाल-वीर हैं!");
                addBadge();
            }, 3000);
        }
        return true;
    }

    sandboxCards.forEach(card => {
        const submitBtn = card.querySelector('.verify-sandbox-btn');
        const meaningInput = card.querySelector('.meaning-input');
        const sentenceInput = card.querySelector('.sentence-input');

        submitBtn.addEventListener('click', () => {
            validateSandboxCard(card, false);
        });

        // Setup speech recognition for meaning and sentence inputs
        const meaningMic = card.querySelector('.meaning-mic');
        const sentenceMic = card.querySelector('.sentence-mic');

        if (SpeechRecognition) {
            bindSandboxMic(meaningMic, meaningInput, () => {
                return validateSandboxCard(card, true); // Auto check when speech completes (quiet mode)
            });
            bindSandboxMic(sentenceMic, sentenceInput, () => {
                return validateSandboxCard(card, true); // Auto check when speech completes (quiet mode)
            });
        } else {
            card.querySelectorAll('.sandbox-mic-btn').forEach(btn => btn.style.display = 'none');
        }

        // Bind play word buttons for sandbox keyword pronunciation
        card.querySelectorAll('.play-word-btn').forEach(playBtn => {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wordToPlay = playBtn.getAttribute('data-word');
                speakText(`${wordToPlay}. ${wordToPlay} का अर्थ और एक वाक्य बताएं.`);
            });
        });
    });

    // Helper function to bind Speech Recognition to sandbox mic buttons
    function bindSandboxMic(btn, inputEl, onResultCallback) {
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.lang = 'hi-IN';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        const card = btn.closest('.sandbox-card');
        const feedback = card.querySelector('.sandbox-feedback-msg');
        let stopDueToSuccess = false;

        btn.addEventListener('click', () => {
            if (btn.classList.contains('listening')) {
                recognition.stop();
                return;
            }

            btn.classList.add('listening');
            btn.textContent = '🔴 सुन रहा हूँ';
            feedback.textContent = 'बोलिए, मैं सुन रहा हूँ...';
            feedback.className = 'sandbox-feedback-msg'; // clear error classes
            stopDueToSuccess = false;
            
            recognition.start();
        });

        recognition.onresult = (event) => {
            if (stopDueToSuccess) return;

            let fullTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
                fullTranscript += event.results[i][0].transcript;
            }
            inputEl.value = fullTranscript;
            
            // Trigger input event to update any visual bindings or trigger validation
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger live check
            if (onResultCallback) {
                const isCorrect = onResultCallback();
                if (isCorrect) {
                    stopDueToSuccess = true;
                    recognition.stop();
                }
            }
        };

        recognition.onspeechend = () => {
            // Do not stop automatically if continuous is true, unless speech has ended naturally
        };

        recognition.onerror = (event) => {
            if (stopDueToSuccess) return;
            feedback.textContent = 'माइक त्रुटि! फिर से बोलें।';
            feedback.className = 'sandbox-feedback-msg incorrect';
            console.error("Sandbox Speech recognition error", event.error);
            recognition.stop();
        };

        recognition.onend = () => {
            btn.classList.remove('listening');
            btn.textContent = '🎙️ बोलें';
            if (feedback.textContent === 'बोलिए, मैं सुन रहा हूँ...') {
                feedback.textContent = '';
            }
        };
    }


    // --- CONFETTI CELEBRATION PHYSICS ENGINE ---
    const canvas = document.getElementById('celebration-canvas');
    const ctx = canvas.getContext('2d');
    
    let particles = [];
    let animationFrameId;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = -20 - Math.random() * 50;
            this.size = Math.random() * 8 + 6;
            this.speedX = Math.random() * 4 - 2;
            this.speedY = Math.random() * 6 + 4;
            this.rotation = Math.random() * 360;
            this.rotationSpeed = Math.random() * 5 - 2.5;
            
            // Random cute pastel color
            const colors = ['#FF9933', '#128807', '#000080', '#ff8c94', '#b19ffb', '#ffb37e', '#a3daff', '#ffd700'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.rotation += this.rotationSpeed;
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate((this.rotation * Math.PI) / 180);
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
            ctx.restore();
        }
    }

    function triggerConfetti(particleCount = 50) {
        cancelAnimationFrame(animationFrameId);
        particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
        
        animateConfetti();
    }

    function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let alive = false;
        particles.forEach(p => {
            p.update();
            p.draw();
            if (p.y < canvas.height) {
                alive = true;
            }
        });

        if (alive) {
            animationFrameId = requestAnimationFrame(animateConfetti);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Init update quiz display
    updateQuizCarousel();
});
