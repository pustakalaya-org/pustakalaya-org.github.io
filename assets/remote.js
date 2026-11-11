/* Linked open books (tools/remote.py): freely licensed books of other sites, read in this library's own format.
 *
 * The site keeps only the catalogue entry, the contents and an empty page (a shell) for each chapter. When a chapter
 * opens, its text is fetched here from the source's API (the MediaWiki API of Wikibooks and Wikisource, `origin=*`),
 * cleaned of the source site's chrome (edit links, navigation boxes, templates), converted to this library's chapter
 * HTML (numbered sections as in the contents, figures with captions, tables, code with its language, mathematics for
 * MathJax, footnotes, links to the other chapters made links to this library's pages) and put into the shell. The page
 * and the reader then show it like any other chapter. The address stays on this site; nothing of the source site is
 * embedded or opened, except the attribution's links, which open in a new tab when they are clicked.
 *
 *   window.pkRemote.fillRec(rec)   for the reader (assets/reader.js): a chapter record whose HTML is a shell, filled
 *   window.pkRemote.fill(el)       fill the shells inside an element
 *   event "pk:remote-filled"       on document, after a chapter has been filled (detail: {book, page, root})
 *
 * A second kind of source is an EPUB in a public GitHub repository (type "standardebooks", the editions of Standard Ebooks,
 * CC0): the chapter's XHTML file is fetched from raw.githubusercontent.com (which allows it) and converted the same way.
 *
 * "Keep for offline reading" (assets/app.js) keeps the shells; for a linked book this script then keeps the source's
 * answers for every chapter (and its pictures) in the cache "pk-remote-kept", which assets/sw.js reads when there is
 * no connection, and removes them when the book is removed from the device.
 */
(function () {
  "use strict";
  var LINKED = {"bhagavad-gita":{"path":"classics/bhagavad-gita","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"rigveda-griffith":{"path":"classics/rigveda-griffith","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"meghaduta":{"path":"classics/meghaduta","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"raghuvamsa":{"path":"classics/raghuvamsa","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"gita-govinda":{"path":"classics/gita-govinda","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"abhijnana-sakuntalam":{"path":"classics/abhijnana-sakuntalam","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"amarakosa":{"path":"classics/amarakosa","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"tirukkural":{"path":"classics/tirukkural","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"gitanjali-bangla":{"path":"classics/gitanjali-bangla","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"anandamath":{"path":"classics/anandamath","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"jnanesvari":{"path":"classics/jnanesvari","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"adhyatma-ramayanam":{"path":"classics/adhyatma-ramayanam","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"jayasi-granthavali":{"path":"classics/jayasi-granthavali","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"little-clay-cart":{"path":"classics/little-clay-cart","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"sadhana-tagore":{"path":"classics/sadhana-tagore","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"bird-of-time-naidu":{"path":"classics/bird-of-time-naidu","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"bhagavad-gita-besant":{"path":"classics/bhagavad-gita-besant","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"history-indian-philosophy-dasgupta-1":{"path":"classics/history-indian-philosophy-dasgupta-1","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"indian-shipping-mookerji":{"path":"classics/indian-shipping-mookerji","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"history-sanskrit-literature-macdonell":{"path":"classics/history-sanskrit-literature-macdonell","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"vasavadatta-subandhu-gray":{"path":"classics/vasavadatta-subandhu-gray","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"aryan-medical-science-gondal":{"path":"classics/aryan-medical-science-gondal","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"secrets-of-the-self-iqbal":{"path":"classics/secrets-of-the-self-iqbal","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"hindi-sahitya-ka-itihas-shukla":{"path":"classics/hindi-sahitya-ka-itihas-shukla","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"nirmala-premchand":{"path":"classics/nirmala-premchand","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"devdas-sarat-chandra":{"path":"classics/devdas-sarat-chandra","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"gitanjali-tagore":{"path":"classics-in-translation/gitanjali-tagore","badge":"From Standard Ebooks · CC0 1.0","name":"Standard Ebooks","type":"standardebooks"},"vikram-and-the-vampire":{"path":"classics-in-translation/vikram-and-the-vampire","badge":"From Standard Ebooks · CC0 1.0","name":"Standard Ebooks","type":"standardebooks"},"my-reminiscences-tagore":{"path":"classics-in-translation/my-reminiscences-tagore","badge":"From Standard Ebooks · CC0 1.0","name":"Standard Ebooks","type":"standardebooks"},"rigveda-wilson-4":{"path":"rare-books/rigveda-wilson-4","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hymns-rigveda-griffith-1":{"path":"rare-books/hymns-rigveda-griffith-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"rigveda-sayana-5":{"path":"rare-books/rigveda-sayana-5","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"atharvaveda-whitney-lanman":{"path":"rare-books/atharvaveda-whitney-lanman","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"aitareya-brahmana-haug-2":{"path":"rare-books/aitareya-brahmana-haug-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"aitareya-brahmana-haug-1":{"path":"rare-books/aitareya-brahmana-haug-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"satapatha-brahmana-eggeling-5":{"path":"rare-books/satapatha-brahmana-eggeling-5","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"pancavimsa-brahmana-caland":{"path":"rare-books/pancavimsa-brahmana-caland","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"baudhayana-srauta-sutra-2":{"path":"rare-books/baudhayana-srauta-sutra-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"samanya-vedanta-upanisads":{"path":"rare-books/samanya-vedanta-upanisads","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"upanisads-sankara-4":{"path":"rare-books/upanisads-sankara-4","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"upanishads-muller-1":{"path":"rare-books/upanishads-muller-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"brihadaranyaka-roer":{"path":"rare-books/brihadaranyaka-roer","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ranade-upanisadic-philosophy":{"path":"rare-books/ranade-upanisadic-philosophy","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"isha-upanishad-aurobindo":{"path":"rare-books/isha-upanishad-aurobindo","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sankhya-philosophy-banerji":{"path":"rare-books/sankhya-philosophy-banerji","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"yoga-sara-sangraha":{"path":"rare-books/yoga-sara-sangraha","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"arthasamgraha-thibaut":{"path":"rare-books/arthasamgraha-thibaut","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ayurvedasutram":{"path":"rare-books/ayurvedasutram","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sushruta-bhishagratna-1":{"path":"rare-books/sushruta-bhishagratna-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sushruta-samhita-jadavji":{"path":"rare-books/sushruta-samhita-jadavji","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"vedic-chronology-tilak":{"path":"rare-books/vedic-chronology-tilak","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ganita-sara-sangraha":{"path":"rare-books/ganita-sara-sangraha","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"surya-siddhanta-wilkinson":{"path":"rare-books/surya-siddhanta-wilkinson","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"pancasiddhantika":{"path":"rare-books/pancasiddhantika","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"brihat-samhita-2-2":{"path":"rare-books/brihat-samhita-2-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-architecture-manasara":{"path":"rare-books/indian-architecture-manasara","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"architecture-of-manasara":{"path":"rare-books/architecture-of-manasara","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"kesava-temple-belur":{"path":"rare-books/kesava-temple-belur","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"six-principal-ragas":{"path":"rare-books/six-principal-ragas","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sangita-darpana":{"path":"rare-books/sangita-darpana","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sanskrit-drama-keith":{"path":"rare-books/sanskrit-drama-keith","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ashtadhyayi-vasu":{"path":"rare-books/ashtadhyayi-vasu","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"nighantu-nirukta":{"path":"rare-books/nighantu-nirukta","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"mahabharata-romesh-dutt":{"path":"rare-books/mahabharata-romesh-dutt","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"arthasastra-ganapati":{"path":"rare-books/arthasastra-ganapati","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"gita-rahasya-tilak":{"path":"rare-books/gita-rahasya-tilak","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindu-chemistry-ray-1":{"path":"rare-books/hindu-chemistry-ray-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindu-chemistry-ray-2":{"path":"rare-books/hindu-chemistry-ray-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"positive-sciences-seal":{"path":"rare-books/positive-sciences-seal","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"aryabhatiya-clark":{"path":"rare-books/aryabhatiya-clark","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"algebra-colebrooke":{"path":"rare-books/algebra-colebrooke","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"arthasastra-shamasastry":{"path":"rare-books/arthasastra-shamasastry","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"laws-of-manu-buhler":{"path":"rare-books/laws-of-manu-buhler","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"gaina-sutras-jacobi-1":{"path":"rare-books/gaina-sutras-jacobi-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"psalms-of-the-sisters":{"path":"rare-books/psalms-of-the-sisters","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"raja-yoga-vivekananda":{"path":"rare-books/raja-yoga-vivekananda","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"dance-of-siva":{"path":"rare-books/dance-of-siva","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ideals-of-indian-art":{"path":"rare-books/ideals-of-indian-art","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"music-of-hindostan":{"path":"rare-books/music-of-hindostan","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"alberunis-india-1":{"path":"rare-books/alberunis-india-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"vedanta-sutras-thibaut":{"path":"rare-books/vedanta-sutras-thibaut","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"gaina-sutras-jacobi-2":{"path":"rare-books/gaina-sutras-jacobi-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"buddhist-mahayana-texts-cowell":{"path":"rare-books/buddhist-mahayana-texts-cowell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"dialogues-of-the-buddha-1":{"path":"rare-books/dialogues-of-the-buddha-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"mediaeval-school-indian-logic":{"path":"rare-books/mediaeval-school-indian-logic","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindu-polity-jayaswal":{"path":"rare-books/hindu-polity-jayaswal","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"materia-medica-hindus-dutt":{"path":"rare-books/materia-medica-hindus-dutt","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"psalms-of-maratha-saints":{"path":"rare-books/psalms-of-maratha-saints","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"word-of-lalla":{"path":"rare-books/word-of-lalla","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"naladiyar-pope":{"path":"rare-books/naladiyar-pope","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"tamil-studies-aiyangar":{"path":"rare-books/tamil-studies-aiyangar","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"rajput-painting-coomaraswamy":{"path":"rare-books/rajput-painting-coomaraswamy","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindu-music-sourindro-tagore":{"path":"rare-books/hindu-music-sourindro-tagore","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"outlines-of-jainism-jaini":{"path":"rare-books/outlines-of-jainism-jaini","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sacred-laws-aryas-buhler-1":{"path":"rare-books/sacred-laws-aryas-buhler-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-eastern-architecture-fergusson":{"path":"rare-books/indian-eastern-architecture-fergusson","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"yoga-system-patanjali-woods":{"path":"rare-books/yoga-system-patanjali-woods","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"yoga-darsana-jha":{"path":"rare-books/yoga-darsana-jha","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"nyaya-sutras-vidyabhusana":{"path":"rare-books/nyaya-sutras-vidyabhusana","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"bhagavad-gita-sankara-mahadeva-sastri":{"path":"rare-books/bhagavad-gita-sankara-mahadeva-sastri","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sankhya-karika-davies":{"path":"rare-books/sankhya-karika-davies","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sarva-darsana-samgraha-cowell":{"path":"rare-books/sarva-darsana-samgraha-cowell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"kalpa-sutra-nava-tatva-stevenson":{"path":"rare-books/kalpa-sutra-nava-tatva-stevenson","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ajivikas-barua":{"path":"rare-books/ajivikas-barua","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"antiquity-hindoo-medicine-royle":{"path":"rare-books/antiquity-hindoo-medicine-royle","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindu-system-medicine-wise":{"path":"rare-books/hindu-system-medicine-wise","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"medicine-ancient-india-hoernle":{"path":"rare-books/medicine-ancient-india-hoernle","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"bazaar-medicines-waring":{"path":"rare-books/bazaar-medicines-waring","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"eclipses-moon-india-sewell":{"path":"rare-books/eclipses-moon-india-sewell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"taittiriya-aranyaka-mitra":{"path":"rare-books/taittiriya-aranyaka-mitra","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"rigveda-muller-1":{"path":"rare-books/rigveda-muller-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"arctic-home-vedas-tilak":{"path":"rare-books/arctic-home-vedas-tilak","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"buddhist-india-rhys-davids":{"path":"rare-books/buddhist-india-rhys-davids","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ancient-india-krishnaswami-aiyangar":{"path":"rare-books/ancient-india-krishnaswami-aiyangar","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hitopadesa-wilkins":{"path":"rare-books/hitopadesa-wilkins","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"panchatantra-hertel-1908":{"path":"rare-books/panchatantra-hertel-1908","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sakuntala-pischel-1922":{"path":"rare-books/sakuntala-pischel-1922","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"nalopakhyanam-monier-williams":{"path":"rare-books/nalopakhyanam-monier-williams","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"narada-smriti-jolly":{"path":"rare-books/narada-smriti-jolly","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"manu-smriti-jha-1-2":{"path":"rare-books/manu-smriti-jha-1-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"manu-smriti-jha-3-1":{"path":"rare-books/manu-smriti-jha-3-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"manu-smriti-jha-notes-2":{"path":"rare-books/manu-smriti-jha-notes-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"manu-smriti-jha-5":{"path":"rare-books/manu-smriti-jha-5","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"kamandakiya-nitisara-ganapati":{"path":"rare-books/kamandakiya-nitisara-ganapati","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"yoga-upanishads-mahadeva-sastri":{"path":"rare-books/yoga-upanishads-mahadeva-sastri","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"mudrarakshasa-dhruva":{"path":"rare-books/mudrarakshasa-dhruva","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sushruta-bhishagratna-2":{"path":"rare-books/sushruta-bhishagratna-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sushruta-bhishagratna-3":{"path":"rare-books/sushruta-bhishagratna-3","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"matsya-purana-dikshitar":{"path":"rare-books/matsya-purana-dikshitar","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"markandeya-purana-pargiter":{"path":"rare-books/markandeya-purana-pargiter","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"vishnu-purana-wilson-5":{"path":"rare-books/vishnu-purana-wilson-5","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"vishnu-puranam-dutt":{"path":"rare-books/vishnu-puranam-dutt","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"purana-text-kali-age-pargiter":{"path":"rare-books/purana-text-kali-age-pargiter","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ancient-indian-historical-tradition":{"path":"rare-books/ancient-indian-historical-tradition","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sahyadri-khanda-skanda-purana":{"path":"rare-books/sahyadri-khanda-skanda-purana","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ramayana-schlegel":{"path":"rare-books/ramayana-schlegel","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sri-rama-chandra-besant":{"path":"rare-books/sri-rama-chandra-besant","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"bhagavadgita-telang":{"path":"rare-books/bhagavadgita-telang","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"upanishads-muller-2":{"path":"rare-books/upanishads-muller-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"rammohun-roy-translation-vedas":{"path":"rare-books/rammohun-roy-translation-vedas","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"grihya-sutras-oldenberg-1":{"path":"rare-books/grihya-sutras-oldenberg-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"grihya-sutras-oldenberg-2":{"path":"rare-books/grihya-sutras-oldenberg-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"baudhayana-srauta-sutra-1":{"path":"rare-books/baudhayana-srauta-sutra-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"orion-tilak":{"path":"rare-books/orion-tilak","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"vedic-grammar-macdonell":{"path":"rare-books/vedic-grammar-macdonell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"vedic-concordance-bloomfield":{"path":"rare-books/vedic-concordance-bloomfield","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"katyayana-patanjali-kielhorn":{"path":"rare-books/katyayana-patanjali-kielhorn","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"prakrita-prakasa-cowell":{"path":"rare-books/prakrita-prakasa-cowell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sanskrit-grammar-whitney":{"path":"rare-books/sanskrit-grammar-whitney","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"monier-williams-dictionary":{"path":"rare-books/monier-williams-dictionary","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"kittel-kannada-english-dictionary":{"path":"rare-books/kittel-kannada-english-dictionary","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"malayalam-english-dictionary-gundert":{"path":"rare-books/malayalam-english-dictionary-gundert","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"dictionary-mixed-telugu-brown":{"path":"rare-books/dictionary-mixed-telugu-brown","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"brahma-alphabet-buhler":{"path":"rare-books/brahma-alphabet-buhler","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-calendar-sewell-dikshit":{"path":"rare-books/indian-calendar-sewell-dikshit","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"historical-view-hindu-astronomy-bentley":{"path":"rare-books/historical-view-hindu-astronomy-bentley","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"aryabhatiya-kern":{"path":"rare-books/aryabhatiya-kern","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-mathematics-kaye":{"path":"rare-books/indian-mathematics-kaye","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"bakhshali-manuscript-hoernle":{"path":"rare-books/bakhshali-manuscript-hoernle","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindu-arabic-numerals":{"path":"rare-books/hindu-arabic-numerals","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindu-achievements-exact-science":{"path":"rare-books/hindu-achievements-exact-science","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"bija-ganita-strachey":{"path":"rare-books/bija-ganita-strachey","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"milindapanho-trenckner":{"path":"rare-books/milindapanho-trenckner","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"questions-of-king-milinda-1":{"path":"rare-books/questions-of-king-milinda-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"questions-of-king-milinda-2":{"path":"rare-books/questions-of-king-milinda-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"dasaratha-jataka-fausboll":{"path":"rare-books/dasaratha-jataka-fausboll","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"jataka-tales-francis-thomas":{"path":"rare-books/jataka-tales-francis-thomas","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"romantic-legend-sakya-buddha":{"path":"rare-books/romantic-legend-sakya-buddha","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"record-of-buddhist-religion-itsing":{"path":"rare-books/record-of-buddhist-religion-itsing","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"prolegomena-buddhist-philosophy-barua":{"path":"rare-books/prolegomena-buddhist-philosophy-barua","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"literary-history-sanskrit-buddhism":{"path":"rare-books/literary-history-sanskrit-buddhism","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"buddhism-of-tibet-waddell":{"path":"rare-books/buddhism-of-tibet-waddell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"pag-sam-jon-zang":{"path":"rare-books/pag-sam-jon-zang","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"way-to-nirvana-poussin":{"path":"rare-books/way-to-nirvana-poussin","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"buddha-gospel-coomaraswamy":{"path":"rare-books/buddha-gospel-coomaraswamy","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"mahavamsa-geiger":{"path":"rare-books/mahavamsa-geiger","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"dathavansa-coomaraswamy":{"path":"rare-books/dathavansa-coomaraswamy","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sragdhara-stotram":{"path":"rare-books/sragdhara-stotram","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"on-the-indian-sect-of-the-jainas":{"path":"rare-books/on-the-indian-sect-of-the-jainas","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"life-stories-parsvanatha-bloomfield":{"path":"rare-books/life-stories-parsvanatha-bloomfield","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"risabha-deva-champat-rai-jain":{"path":"rare-books/risabha-deva-champat-rai-jain","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"inscriptions-sravana-belgola":{"path":"rare-books/inscriptions-sravana-belgola","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sikh-religion-macauliffe-2":{"path":"rare-books/sikh-religion-macauliffe-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sikh-religion-macauliffe-3":{"path":"rare-books/sikh-religion-macauliffe-3","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sikh-religion-macauliffe-5":{"path":"rare-books/sikh-religion-macauliffe-5","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sikh-religion-macauliffe-6":{"path":"rare-books/sikh-religion-macauliffe-6","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"compass-of-truth-dara-shikoh":{"path":"rare-books/compass-of-truth-dara-shikoh","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"srikara-bhashya-1":{"path":"rare-books/srikara-bhashya-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"study-of-patanjali-dasgupta":{"path":"rare-books/study-of-patanjali-dasgupta","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"yoga-aphorisms-judge":{"path":"rare-books/yoga-aphorisms-judge","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"outlines-indian-philosophy-srinivasa-iyengar":{"path":"rare-books/outlines-indian-philosophy-srinivasa-iyengar","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"early-history-vaishnavism-south-india":{"path":"rare-books/early-history-vaishnavism-south-india","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"brahmanism-hinduism-monier-williams":{"path":"rare-books/brahmanism-hinduism-monier-williams","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"mystics-ascetics-saints-oman":{"path":"rare-books/mystics-ascetics-saints-oman","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindu-feasts-fasts-natesa-sastri":{"path":"rare-books/hindu-feasts-fasts-natesa-sastri","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"chaitanya-life-teachings-sarkar":{"path":"rare-books/chaitanya-life-teachings-sarkar","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"harsa-carita-cowell-thomas":{"path":"rare-books/harsa-carita-cowell-thomas","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindoo-tales-ten-princes-jacob":{"path":"rare-books/hindoo-tales-ten-princes-jacob","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"malavikagnimitra-tawney":{"path":"rare-books/malavikagnimitra-tawney","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"select-specimens-theatre-hindus-1":{"path":"rare-books/select-specimens-theatre-hindus-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"select-specimens-theatre-hindus-2":{"path":"rare-books/select-specimens-theatre-hindus-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-song-of-songs-arnold":{"path":"rare-books/indian-song-of-songs-arnold","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"century-of-indian-epigrams-more":{"path":"rare-books/century-of-indian-epigrams-more","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"womens-eyes-ryder":{"path":"rare-books/womens-eyes-ryder","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"kathakosa-tawney":{"path":"rare-books/kathakosa-tawney","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"literary-history-india-frazer":{"path":"rare-books/literary-history-india-frazer","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"padumawati-jayasi-grierson":{"path":"rare-books/padumawati-jayasi-grierson","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"romantic-tales-panjab-swynnerton":{"path":"rare-books/romantic-tales-panjab-swynnerton","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-nights-entertainment-swynnerton":{"path":"rare-books/indian-nights-entertainment-swynnerton","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"deccan-nursery-tales-kincaid":{"path":"rare-books/deccan-nursery-tales-kincaid","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"tale-of-the-tulsi-plant-kincaid":{"path":"rare-books/tale-of-the-tulsi-plant-kincaid","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"folklore-konkan-jackson-enthoven":{"path":"rare-books/folklore-konkan-jackson-enthoven","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"folklore-southern-india-natesa-sastri":{"path":"rare-books/folklore-southern-india-natesa-sastri","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"rhymes-of-rajputana-trevor":{"path":"rare-books/rhymes-of-rajputana-trevor","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ras-mala-forbes":{"path":"rare-books/ras-mala-forbes","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"kamandakiya-nitisara-dutt":{"path":"rare-books/kamandakiya-nitisara-dutt","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"manava-dharmasastra-jolly":{"path":"rare-books/manava-dharmasastra-jolly","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"evolution-indian-polity-shamasastry":{"path":"rare-books/evolution-indian-polity-shamasastry","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"local-government-ancient-india-mookerji":{"path":"rare-books/local-government-ancient-india-mookerji","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"nationalism-hindu-culture-mookerji":{"path":"rare-books/nationalism-hindu-culture-mookerji","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"mirror-of-gesture-coomaraswamy":{"path":"rare-books/mirror-of-gesture-coomaraswamy","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"somanathapur-keshava-temple":{"path":"rare-books/somanathapur-keshava-temple","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"summary-of-the-manasara":{"path":"rare-books/summary-of-the-manasara","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"principles-indian-silpasastra-bose":{"path":"rare-books/principles-indian-silpasastra-bose","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"south-indian-images-krishna-sastri":{"path":"rare-books/south-indian-images-krishna-sastri","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"elements-hindu-iconography-1-1":{"path":"rare-books/elements-hindu-iconography-1-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"elements-hindu-iconography-1-2":{"path":"rare-books/elements-hindu-iconography-1-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hindu-art-sarkar":{"path":"rare-books/hindu-art-sarkar","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"arts-crafts-india-ceylon-coomaraswamy":{"path":"rare-books/arts-crafts-india-ceylon-coomaraswamy","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-craftsman-coomaraswamy":{"path":"rare-books/indian-craftsman-coomaraswamy","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"visvakarma-coomaraswamy":{"path":"rare-books/visvakarma-coomaraswamy","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"basis-artistic-industrial-revival-havell":{"path":"rare-books/basis-artistic-industrial-revival-havell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-architecture-havell":{"path":"rare-books/indian-architecture-havell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ancient-medieval-architecture-india-havell":{"path":"rare-books/ancient-medieval-architecture-india-havell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"rock-cut-temples-fergusson":{"path":"rare-books/rock-cut-temples-fergusson","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-painting-percy-brown":{"path":"rare-books/indian-painting-percy-brown","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"music-instruments-southern-india-day":{"path":"rare-books/music-instruments-southern-india-day","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ancient-india-rc-dutt":{"path":"rare-books/ancient-india-rc-dutt","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"peep-early-history-india-bhandarkar":{"path":"rare-books/peep-early-history-india-bhandarkar","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"early-history-dekkan-bhandarkar":{"path":"rare-books/early-history-dekkan-bhandarkar","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"early-history-india-vincent-smith":{"path":"rare-books/early-history-india-vincent-smith","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"asoka-vincent-smith":{"path":"rare-books/asoka-vincent-smith","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"asoka-mookerji":{"path":"rare-books/asoka-mookerji","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sources-vijayanagar-history":{"path":"rare-books/sources-vijayanagar-history","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"some-contributions-south-india-culture":{"path":"rare-books/some-contributions-south-india-culture","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"historical-inscriptions-southern-india":{"path":"rare-books/historical-inscriptions-southern-india","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"political-history-ancient-india-raychaudhuri":{"path":"rare-books/political-history-ancient-india-raychaudhuri","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"lectures-ancient-indian-numismatics":{"path":"rare-books/lectures-ancient-indian-numismatics","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"epoch-of-the-guptas-thomas":{"path":"rare-books/epoch-of-the-guptas-thomas","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"guide-to-taxila-marshall":{"path":"rare-books/guide-to-taxila-marshall","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"megasthenes-ancient-india-mccrindle":{"path":"rare-books/megasthenes-ancient-india-mccrindle","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"invasion-of-india-alexander-mccrindle":{"path":"rare-books/invasion-of-india-alexander-mccrindle","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sri-harsha-kanauj-panikkar":{"path":"rare-books/sri-harsha-kanauj-panikkar","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"history-mediaeval-hindu-india-vaidya-1":{"path":"rare-books/history-mediaeval-hindu-india-vaidya-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"forgotten-empire-vijayanagar-sewell":{"path":"rare-books/forgotten-empire-vijayanagar-sewell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"life-hiuen-tsiang-beal":{"path":"rare-books/life-hiuen-tsiang-beal","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"hortus-indicus-malabaricus-1":{"path":"rare-books/hortus-indicus-malabaricus-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-operation-couching-elliot":{"path":"rare-books/indian-operation-couching-elliot","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"indian-medicinal-plants-kirtikar-basu-1":{"path":"rare-books/indian-medicinal-plants-kirtikar-basu-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"catalogue-indian-medicinal-plants-fleming":{"path":"rare-books/catalogue-indian-medicinal-plants-fleming","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sacred-chank-hornell":{"path":"rare-books/sacred-chank-hornell","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"omens-superstitions-southern-india-thurston":{"path":"rare-books/omens-superstitions-southern-india-thurston","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"classical-dictionary-hindu-mythology-dowson":{"path":"rare-books/classical-dictionary-hindu-mythology-dowson","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"panchatantra-buhler-2":{"path":"rare-books/panchatantra-buhler-2","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"panchatantra-buhler-3":{"path":"rare-books/panchatantra-buhler-3","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"panchatantra-ryder":{"path":"tales-folklore/panchatantra-ryder","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"katha-sarit-sagara-tawney":{"path":"tales-folklore/katha-sarit-sagara-tawney","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"folk-tales-of-bengal":{"path":"tales-folklore/folk-tales-of-bengal","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"old-deccan-days":{"path":"tales-folklore/old-deccan-days","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"ancient-ballads-toru-dutt":{"path":"tales-folklore/ancient-ballads-toru-dutt","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"indian-fairy-tales-jacobs":{"path":"tales-folklore/indian-fairy-tales-jacobs","badge":"From Standard Ebooks · CC0 1.0","name":"Standard Ebooks","type":"standardebooks"},"cradle-tales-nivedita":{"path":"tales-folklore/cradle-tales-nivedita","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"myths-hindus-buddhists":{"path":"tales-folklore/myths-hindus-buddhists","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"burhi-aair-sadhu":{"path":"tales-folklore/burhi-aair-sadhu","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"tales-of-the-punjab-steel":{"path":"tales-folklore/tales-of-the-punjab-steel","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"kural-aiyar":{"path":"bhakti-regional/kural-aiyar","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"songs-of-kabir":{"path":"bhakti-regional/songs-of-kabir","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"ramayana-tulsidas-growse":{"path":"bhakti-regional/ramayana-tulsidas-growse","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"sikh-religion-macauliffe-1":{"path":"bhakti-regional/sikh-religion-macauliffe-1","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"tiruvacagam-pope":{"path":"bhakti-regional/tiruvacagam-pope","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"verses-of-vemana":{"path":"bhakti-regional/verses-of-vemana","badge":"From Internet Archive · Public domain in India","name":"Internet Archive","type":"archive"},"kabir-granthavali":{"path":"bhakti-regional/kabir-granthavali","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"},"bhramaragita-sara":{"path":"bhakti-regional/bhramaragita-sara","badge":"From Wikisource · Public domain","name":"Wikisource","type":"wikisource"}};                       // {id: {path, badge, name}}: written by tools/remote.py
  var ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) { var e = document.querySelector('script[src*="assets/remote.js"]'); s = e && e.src; }
    try { return new URL("../", s || location.href).href; } catch (x) { return location.origin + "/"; }
  })();
  var ROOT_PATH = new URL(ROOT).pathname;
  var KEEP = "bjp-offline", META = ROOT + "offline-meta/", KEPT = "pk-remote-kept";
  var CHUNK = 40;                                     // parts fetched together (the pages of a chapter made of parts)
  var memo = {}, metas = {}, wantHash = "";

  function noop() {}
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function norm(s) { return String(s || "").normalize("NFC").toLowerCase().replace(/[\s_ ]+/g, " ").replace(/[^\p{L}\p{N} ]+/gu, "").trim(); }
  function online() { return navigator.onLine !== false; }

  /* ---------------------------------------------------------------- the books and their chapters */
  function bookOfPath(path) {
    var rel = path.indexOf(ROOT_PATH) === 0 ? path.slice(ROOT_PATH.length) : "", best = null;
    Object.keys(LINKED).forEach(function (id) {
      var p = LINKED[id].path + "/";
      if (rel.indexOf(p) === 0 && (!best || p.length > LINKED[best].path.length + 1)) best = id;
    });
    return best;
  }
  function bookMeta(id) {
    if (!metas[id]) {
      metas[id] = fetch(ROOT + LINKED[id].path + "/remote.json", { credentials: "same-origin" }).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      }).then(function (m) {
        m.byPage = {}; m.byFile = {};
        m.chapters.forEach(function (c) {
          m.byFile[c.page] = c.f;
          m.byPage[norm(c.page)] = c.f;
          (c.parts || []).forEach(function (p) { m.byPage[norm(p.page)] = c.f + "#" + p.id; });
        });
        return m;
      });
      metas[id].catch(function () { delete metas[id]; });
    }
    return metas[id];
  }
  function chapterOf(m, page) {
    for (var i = 0; i < m.chapters.length; i++) if (m.chapters[i].page === page) return m.chapters[i];
    return null;
  }

  /* ---------------------------------------------------------------- the source's addresses (the same for reading
     and for keeping, so that a kept answer is found again) */
  function qs(pairs) { return pairs.map(function (p) { return encodeURIComponent(p[0]) + "=" + encodeURIComponent(p[1]); }).join("&"); }
  var BASE = [["action", "parse"], ["format", "json"], ["formatversion", "2"], ["origin", "*"], ["prop", "text|revid"],
              ["disableeditsection", "1"], ["disabletoc", "1"], ["maxage", "3600"], ["smaxage", "86400"]];
  function isSE(m) { return m.type === "standardebooks"; }
  function textUrls(m, c) {
    if (isSE(m)) return [m.base + c.page];
    if (!c.parts) return [m.api + "?" + qs(BASE.concat([["redirects", "1"], ["page", c.page]]))];
    var out = [];
    for (var i = 0; i < c.parts.length; i += CHUNK) {
      var t = "";
      c.parts.slice(i, i + CHUNK).forEach(function (p, k) { t += '<div class="pk-part" data-i="' + (i + k) + '"></div>\n{{:' + p.page + "}}\n"; });
      out.push(m.api + "?" + qs(BASE.concat([["contentmodel", "wikitext"], ["title", c.page], ["text", t]])));
    }
    return out;
  }
  function creditUrl(m, c) {
    return m.api + "?" + qs([["action", "query"], ["format", "json"], ["formatversion", "2"], ["origin", "*"], ["prop", "contributors"],
      ["pclimit", "8"], ["pcexcludegroup", "bot"], ["maxage", "3600"], ["smaxage", "86400"], ["titles", c.page]]);
  }
  function getText(url) {
    var k = "T " + url;
    if (!memo[k]) {
      memo[k] = fetch(url, { credentials: "omit", mode: "cors" }).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.text();
      });
      memo[k].catch(function () { delete memo[k]; });
    }
    return memo[k];
  }
  function getJSON(url) {
    if (!memo[url]) {
      memo[url] = fetch(url, { credentials: "omit", mode: "cors" }).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      }).then(function (j) {
        if (j && j.error) throw new Error(j.error.info || "error");
        return j;
      });
      memo[url].catch(function () { delete memo[url]; });
    }
    return memo[url];
  }

  /* ---------------------------------------------------------------- cleaning and converting */
  var DROP = [
    "style", "script", "link", "meta", "noscript", ".mw-editsection", ".mw-empty-elt", ".noprint", ".ws-noexport", ".metadata",
    ".navbox", ".vertical-navbox", ".navbox-styles", ".NavFrame", ".NavHead", ".infobox", ".ambox", ".mbox", ".ombox", ".tmbox",
    ".toc", "#toc", ".toclimit-2", ".catlinks", ".printfooter", ".wst-header", ".ws-header", "#headerContainer", ".headertemplate",
    ".ws-pagenum", ".pagenum", ".pagenum-inner", ".mwe-math-fallback-image-inline", ".mwe-math-fallback-image-display",
    ".mw-cite-backlink", ".sistersitebox", ".plainSister", ".interProject", ".BookCat", ".wikibooks-navigation",
    ".noexcerpt", ".mw-kartographer-maplink", ".magnify", "[role=navigation]", ".licenseContainer", ".ws-license",
    ".wst-licence", ".PD-old", ".stub", ".rellink", ".hatnote", ".dablink", ".mw-jump-link", ".mw-references-columns > h2",
    "#dynamic_layout_overrider"
  ];
  var CLASS_MAP = { "center": "pk-center", "wst-center": "pk-center", "wst-block-center": "pk-center", "wst-rh": "pk-center",
    "i1": "pk-i1", "i2": "pk-i2", "i3": "pk-i3", "i4": "pk-i4", "ws-poem": "pk-poem", "ws-poem-stanza": "pk-stanza", "wst-rule": "pk-rule", "wst-smallcaps": "pk-sc", "wst-sc": "pk-sc",
    "wst-larger": "pk-larger", "wst-x-larger": "pk-larger", "wst-smaller": "pk-smaller", "wst-right": "pk-right", "mw-poem-indented": "pk-indent" };
  var KEEP_CLASS = /^(arithmatex|highlight|language-[\w+#-]+|footnote|footnote-ref|footnote-backref|fig|fig-diagram|headerlink|pk-[\w-]+|md-typeset__[\w-]+)$/;

  function absUrl(m, u) {
    if (!u) return u;
    if (/^\/\//.test(u)) return "https:" + u;
    if (/^\//.test(u)) return m.site + u;
    return u;
  }
  function cleanImgUrl(m, u) {
    u = absUrl(m, u);
    return u.replace(/[?&]utm_[a-z]+=[^&\s]*/g, "").replace(/\?&/, "?").replace(/\?$/, "");
  }
  function unwrap(el) {
    var p = el.parentNode;
    if (!p) return;
    while (el.firstChild) p.insertBefore(el.firstChild, el);
    p.removeChild(el);
  }
  function replaceTag(doc, el, tag) {
    var n = doc.createElement(tag);
    while (el.firstChild) n.appendChild(el.firstChild);
    el.parentNode.replaceChild(n, el);
    return n;
  }
  function titleFromHref(m, href) {
    var h = href;
    if (h.indexOf(m.site) === 0) h = h.slice(m.site.length);
    var mm = /^\/wiki\/([^?#]+)(#.*)?$/.exec(h);
    if (mm) return { page: decodeURIComponent(mm[1]).replace(/_/g, " "), frag: mm[2] ? decodeURIComponent(mm[2].slice(1)) : "" };
    mm = /^\/w\/index\.php\?(.*)$/.exec(h);
    if (mm) {
      var q = new URLSearchParams(mm[1]);
      if (q.get("redlink") || q.get("action") === "edit") return { red: true };
      if (q.get("title") && !q.get("action") && !q.get("oldid")) return { page: q.get("title").replace(/_/g, " "), frag: "" };
    }
    return null;
  }
  /* a box of links to other pages of the book (the source site's navigation): mostly links, little text */
  function isNav(el) {
    var links = el.querySelectorAll('a[href]'), inner = 0, ltext = 0, i;
    if (el.querySelector('a[href="#top"]')) return true;
    for (i = 0; i < links.length; i++) {
      var h = links[i].getAttribute("href") || "";
      if (/^\/wiki\/|^\/w\/index\.php/.test(h)) { inner++; ltext += links[i].textContent.trim().length; }
    }
    var text = el.textContent.replace(/\s+/g, " ").trim();
    if (inner < 2 || !text.length) return false;
    var rest = text.replace(/[←→\-–—·|•,:;()\[\]\s]/g, "").length;
    return text.length < 1200 && ltext / Math.max(1, rest) > 0.55;
  }

  /* convert the source's HTML of one page (or one part) in place; returns nothing */
  function cleanPage(doc, root, m, ctx) {
    var i, list, el;
    // comments
    var walker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null), dead = [];
    while (walker.nextNode()) dead.push(walker.currentNode);
    dead.forEach(function (n) { n.parentNode.removeChild(n); });
    root.querySelectorAll(DROP.concat(m.drop || []).join(",")).forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
    // wrappers of the parser
    root.querySelectorAll(".mw-parser-output, .prp-pages-output, .mw-content-ltr, .mw-content-rtl").forEach(function (e) {
      if (e !== root) unwrap(e);
    });
    // the source site's navigation: tables and boxes of links to other pages, at the top level
    Array.prototype.slice.call(root.querySelectorAll("table, div, center")).forEach(function (e) {
      if (!e.parentNode || e.closest("figure, .thumb, .gallery")) return;
      if (e.matches("table.wikitable, table.prettytable")) return;
      if (isNav(e)) e.parentNode.removeChild(e);
    });
    // headings: <div class="mw-heading"><h2 id=..>..</h2></div> and the older <h2><span class="mw-headline" id=..>
    root.querySelectorAll(".mw-heading").forEach(function (e) { unwrap(e); });
    root.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(function (h) {
      var hl = h.querySelector(".mw-headline");
      if (hl) { if (hl.id && !h.id) h.id = hl.id; unwrap(hl); }
      h.querySelectorAll(".mw-headline-number").forEach(function (x) { x.remove(); });
      if (h.id) ctx.oldIds[h.id] = h;
    });
    // mathematics: MathML (or TeX, where the source gives it) for MathJax
    Array.prototype.slice.call(root.querySelectorAll("math")).forEach(function (mth) {
      if (!mth.parentNode) return;
      var host = mth.closest(".mwe-math-element") || mth;     // the <math> itself, or the older <span> around it
      var cls = (host.getAttribute("class") || "") + " " + (mth.getAttribute("class") || "");
      var block = mth.getAttribute("display") === "block" || /mwe-math-element-block|mwe-math-mathml-display/.test(cls);
      var tex = "", ann = mth.querySelector('annotation[encoding="application/x-tex"]');
      if (ann) tex = ann.textContent;
      else if (mth.getAttribute("alttext")) tex = mth.getAttribute("alttext");
      tex = tex.replace(/^\s*\{\\displaystyle\s*([\s\S]*)\}\s*$/, "$1").trim();
      var box = doc.createElement(block ? "div" : "span");
      box.className = "arithmatex";
      host.parentNode.insertBefore(box, host);
      host.parentNode.removeChild(host);
      if (tex) {
        box.textContent = block ? "\\[" + tex + "\\]" : "\\(" + tex + "\\)";
      } else {
        // MathML (what the source sends today): MathJax typesets it like TeX; without MathJax the browser draws it
        mth.querySelectorAll('[class*="mwe-math-columnalign-"]').forEach(function (td) {
          var al = /mwe-math-columnalign-(\w)/.exec(td.getAttribute("class"))[1];
          td.setAttribute("columnalign", { l: "left", r: "right", c: "center" }[al] || "center");
          td.removeAttribute("class");
        });
        mth.removeAttribute("class");
        mth.removeAttribute("alttext");
        if (block) mth.setAttribute("display", "block");
        box.appendChild(mth);
      }
      ctx.math = true;
    });
    // code: <div class="mw-highlight mw-highlight-lang-c"><pre>..</pre></div>
    root.querySelectorAll("div.mw-highlight, pre.mw-highlight").forEach(function (d) {
      var lang = (/mw-highlight-lang-([\w+#-]+)/.exec(d.className) || [])[1] || "";
      var pre = d.nodeName === "PRE" ? d : d.querySelector("pre");
      if (!pre) return;
      var inner = pre.innerHTML.replace(/^<span><\/span>/, "");
      var w = doc.createElement("div");
      w.className = (lang && lang !== "text" ? "language-" + lang + " " : "") + "highlight";
      w.innerHTML = "<pre><span></span><code>" + inner + "</code></pre>";
      d.parentNode.replaceChild(w, d);
    });
    // verse: <div class="poem">, and <div class="verse"><pre> on Wikisource
    root.querySelectorAll("div.poem").forEach(function (d) { d.className = "pk-poem"; });
    root.querySelectorAll(".verse pre, .poem pre").forEach(function (p) {
      var d = doc.createElement("div");
      d.className = "pk-poem pk-pre";
      d.innerHTML = p.innerHTML;
      p.parentNode.replaceChild(d, p);
    });
    root.querySelectorAll("pre").forEach(function (p) {
      if (p.closest(".highlight") || p.querySelector("code")) return;
      var w = doc.createElement("div");
      w.className = "highlight";
      w.innerHTML = "<pre><span></span><code>" + p.innerHTML + "</code></pre>";
      p.parentNode.replaceChild(w, p);
    });
    // figures: <figure typeof="mw:File/Thumb">, the older <div class="thumb">, galleries
    function figure(img, cap) {
      var f = doc.createElement("figure");
      f.className = "fig fig-diagram";
      f.appendChild(img);
      if (cap && cap.textContent.trim()) {
        var fc = doc.createElement("figcaption");
        while (cap.firstChild) fc.appendChild(cap.firstChild);
        f.appendChild(fc);
      }
      return f;
    }
    root.querySelectorAll('figure[typeof^="mw:File"], figure[typeof^="mw:Image"], div.thumb, li.gallerybox').forEach(function (fg) {
      var img = fg.querySelector("img");
      if (!img) { fg.parentNode.removeChild(fg); return; }
      var cap = fg.querySelector("figcaption, .thumbcaption, .gallerytext");
      var f = figure(img, cap);
      fg.parentNode.replaceChild(f, fg);
    });
    // a picture with its caption below it, in a box of its own (an older way of writing a figure)
    root.querySelectorAll("div, center").forEach(function (d) {
      var kids = Array.prototype.filter.call(d.childNodes, function (n) { return n.nodeType === 1 || n.textContent.trim(); });
      var img = kids[0] && (kids[0].nodeName === "IMG" ? kids[0] : kids[0].querySelector && kids[0].matches('span[typeof^="mw:File"], a') && kids[0].querySelector("img"));
      if (!img || kids.length < 2 || kids.length > 3 || d.closest("figure")) return;
      var rest = kids.slice(1).filter(function (n) { return n.nodeName !== "BR"; });
      if (rest.length !== 1 || !/^(I|EM|SMALL|P|DIV|SPAN)$/.test(rest[0].nodeName) || rest[0].querySelector("img, table")) return;
      d.parentNode.replaceChild(figure(img, rest[0]), d);
    });
    root.querySelectorAll("ul.gallery").forEach(function (g) {
      var d = doc.createElement("div");
      d.className = "pk-gallery";
      while (g.firstChild) { var c = g.firstChild; g.removeChild(c); if (c.nodeType === 1 && c.nodeName === "FIGURE") d.appendChild(c); }
      g.parentNode.replaceChild(d, g);
    });
    root.querySelectorAll("img").forEach(function (img) {
      var w = parseInt(img.getAttribute("width"), 10) || 0, h = parseInt(img.getAttribute("height"), 10) || 0;
      if (w && h && w <= 24 && h <= 24 && !img.closest("figure")) { (img.closest('span[typeof^="mw:File"]') || img).remove(); return; }
      img.setAttribute("src", cleanImgUrl(m, img.getAttribute("src")));
      var ss = img.getAttribute("srcset");
      if (ss) img.setAttribute("srcset", ss.split(",").map(function (s) { var p = s.trim().split(/\s+/); p[0] = cleanImgUrl(m, p[0]); return p.join(" "); }).join(", "));
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      ["class", "data-file-width", "data-file-height", "typeof", "resource"].forEach(function (a) { img.removeAttribute(a); });
      var a = img.closest("a");
      if (a && (/mw-file-description|image/.test(a.className) || /\/wiki\/[^\/]*:/.test(a.getAttribute("href") || ""))) unwrap(a);
      var sp = img.closest('span[typeof^="mw:File"]');
      if (sp) unwrap(sp);
    });
    // links
    root.querySelectorAll("a").forEach(function (a) {
      var href = a.getAttribute("href");
      if (!href || a.classList.contains("new") || a.classList.contains("mw-selflink")) { if (!a.classList.contains("footnote-ref")) unwrap(a); return; }
      if (a.classList.contains("footnote-ref") || a.classList.contains("headerlink")) return;
      if (href.charAt(0) === "#") { ctx.anchors.push(a); return; }
      href = absUrl(m, href);
      if (href.indexOf(ROOT) === 0) return;                // already a page of this library
      var t = titleFromHref(m, href);
      if (t && t.red) { unwrap(a); return; }
      if (t && t.page && m.byPage[norm(t.page)]) {
        var target = m.byPage[norm(t.page)];
        a.setAttribute("href", ROOT + LINKED[m.id].path + "/" + target);
        a.removeAttribute("title");
        a.removeAttribute("class");
        return;
      }
      a.setAttribute("href", href);
      if (/^https?:/.test(href)) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        a.className = "pk-ext";
      }
    });
    // footnotes
    root.querySelectorAll('sup.reference').forEach(function (s) {
      var a = s.querySelector('a[href^="#"]');
      if (!a) { s.remove(); return; }
      var id = decodeURIComponent(a.getAttribute("href").slice(1));
      var k = ctx.notes[ctx.prefix + id];
      if (!k) { k = ctx.notes[ctx.prefix + id] = ++ctx.nnote; ctx.order.push({ key: ctx.prefix + id, id: id, k: k, root: root }); }
      var fid = ctx.fn(k);
      var sup = doc.createElement("sup");
      if (!ctx.refSeen[k]) { sup.id = "fnref:" + fid; ctx.refSeen[k] = 1; }
      sup.innerHTML = '<a class="footnote-ref" href="#fn:' + fid + '">' + k + "</a>";
      s.parentNode.replaceChild(sup, s);
    });
    var notesHtml = {};
    root.querySelectorAll("ol.references > li[id]").forEach(function (li) {
      var t = li.querySelector(".reference-text") || li;
      notesHtml[li.id] = t;
    });
    ctx.order.forEach(function (o) {
      if (o.root === root && notesHtml[o.id] && !o.node) o.node = notesHtml[o.id];
    });
    root.querySelectorAll(".mw-references-wrap, ol.references, .reflist, .references-small, .smallrefs").forEach(function (e) {
      var prev = e.previousElementSibling;
      if (e.parentNode) e.parentNode.removeChild(e);
      if (prev && /^H[2-6]$/.test(prev.nodeName) && (!prev.nextElementSibling || /^H[1-6]$/.test(prev.nextElementSibling.nodeName))) prev.remove();
    });
    // tables: the data tables keep their cells; layout tables give up their contents
    root.querySelectorAll("table").forEach(function (t) {
      if (!t.parentNode) return;
      var cells = t.querySelectorAll("td, th").length;
      if (t.getAttribute("role") === "presentation" || cells <= 1) {
        var d = doc.createElement("div");
        t.querySelectorAll("td, th, caption").forEach(function (c) { while (c.firstChild) d.appendChild(c.firstChild); });
        t.parentNode.replaceChild(d, t);
        unwrap(d);
        return;
      }
      if (t.parentNode.classList && t.parentNode.classList.contains("md-typeset__table")) return;
      var w1 = doc.createElement("div"), w2 = doc.createElement("div");
      w1.className = "md-typeset__scrollwrap";
      w2.className = "md-typeset__table";
      t.parentNode.replaceChild(w1, t);
      w1.appendChild(w2);
      w2.appendChild(t);
    });
    // the source's own layout classes that have a counterpart here
    Object.keys(CLASS_MAP).forEach(function (k) {
      root.querySelectorAll("." + k).forEach(function (e) { e.classList.add(CLASS_MAP[k]); });
    });
    // a box that opens with a term alone (a definition, an example, a theorem): a box with that title
    root.querySelectorAll("div").forEach(function (d) {
      var dl = d.firstElementChild;
      if (!dl || dl.nodeName !== "DL" || dl.children.length > 2 || !dl.children[0] || dl.children[0].nodeName !== "DT") return;
      if (dl.children[1] && (dl.children[1].nodeName !== "DD" || dl.children[1].textContent.trim())) return;
      var t = doc.createElement("p");
      t.className = "pk-box-title";
      while (dl.children[0].firstChild) t.appendChild(dl.children[0].firstChild);
      d.replaceChild(t, dl);
      d.classList.add("pk-box");
    });
    // old presentational markup
    root.querySelectorAll("font, big, span:not([class]):not([lang]):not([id])").forEach(function (e) { unwrap(e); });
    root.querySelectorAll("center").forEach(function (e) { replaceTag(doc, e, "div").className = "pk-center"; });
    stripAttrs(root, ctx);
    // empty headings
    root.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(function (h) { if (!h.textContent.trim() && !h.querySelector("img, math")) h.remove(); });
    // empty paragraphs and lines
    root.querySelectorAll("p").forEach(function (p) { if (!p.textContent.trim() && !p.querySelector("img, math, .arithmatex")) p.remove(); });
  }

  /* attributes: no styles, no classes of the source site, no data of its parser */
  function stripAttrs(root, ctx) {
    root.querySelectorAll("*").forEach(function (e) {
      if (e.closest("math")) return;                       // MathML keeps its own attributes
      Array.prototype.slice.call(e.attributes).forEach(function (at) {
        var n = at.name;
        if (n === "class") {
          var keep = at.value.split(/\s+/).filter(function (c) { return KEEP_CLASS.test(c); });
          if (keep.length) e.setAttribute("class", keep.join(" ")); else e.removeAttribute("class");
        } else if (n === "style" || n === "align" || n === "valign" || n === "bgcolor" || n === "width" && e.nodeName !== "IMG" ||
                   n === "height" && e.nodeName !== "IMG" || n === "border" || n === "cellpadding" || n === "cellspacing" ||
                   n === "about" || n === "typeof" || n === "dir" && e !== root || n.indexOf("data-") === 0 && !(e.classList.contains("pk-part")) ||
                   n === "title" && e.nodeName !== "ABBR" && e.nodeName !== "IMG" || n === "role" || n.indexOf(":") > 0 || n === "xmlns" || n === "aria-hidden" && e.nodeName === "SPAN") {
          e.removeAttribute(n);
        } else if (n === "id" && !/^H[1-6]$/.test(e.nodeName) && !/^fn/.test(at.value)) {
          ctx.oldIds[at.value] = e;
        }
      });
    });
  }


  /* ---------------------------------------------------------------- EPUB chapters (Standard Ebooks) */
  function et(e) { return (e.getAttribute && e.getAttribute("epub:type")) || ""; }
  function hasType(e, re) { return re.test(et(e)); }
  /* the XHTML of one chapter file into `root` (the headings, verse, plays, notes and pictures in this library's HTML) */
  function loadSE(doc, root, ans, m, c) {
    var pd = new DOMParser().parseFromString(ans.xhtml, "text/html");
    var body = pd.body, base = m.base + c.page;
    // the file's own heading is the chapter's title, which the page already shows
    var first = body.querySelector("h1, h2, h3, h4, h5, h6");
    if (first && !first.closest("blockquote, figure, table")) {
      var hg = first.closest("hgroup");
      if (hg) hg.remove();
      else {
        var nx = first.nextElementSibling;
        if (nx && /subtitle/.test(et(nx))) nx.remove();
        first.remove();
      }
    }
    root.innerHTML = body.innerHTML;
    root.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(function (h) {
      var w = doc.createTreeWalker(h, NodeFilter.SHOW_TEXT, null), n;
      while ((n = w.nextNode())) n.nodeValue = n.nodeValue.replace(/\s+/g, " ");
      if (h.firstChild && h.firstChild.nodeType === 3) h.firstChild.nodeValue = h.firstChild.nodeValue.replace(/^ /, "");
      if (h.lastChild && h.lastChild.nodeType === 3) h.lastChild.nodeValue = h.lastChild.nodeValue.replace(/ $/, "");
    });
    root.querySelectorAll("*").forEach(function (e) {
      var xl = e.getAttribute("xml:lang");
      if (xl) { e.setAttribute("lang", xl); }
    });
    // notes: the references of the chapter, with the text of its notes from the book's endnotes file
    var needed = [], notes = {};
    if (ans.notes) {
      var nd = new DOMParser().parseFromString(ans.notes, "text/html");
      nd.querySelectorAll("li[id]").forEach(function (li) { notes[li.id] = li; });
    }
    Array.prototype.slice.call(root.querySelectorAll("a")).forEach(function (a) {
      if (!hasType(a, /\bnoteref\b/)) return;
      var id = ((a.getAttribute("href") || "").split("#")[1]) || "";
      if (!id || !notes[id]) { a.remove(); return; }
      var s = doc.createElement("sup"), l = doc.createElement("a");
      s.className = "reference";
      l.setAttribute("href", "#" + id);
      s.appendChild(l);
      a.parentNode.replaceChild(s, a);
      if (needed.indexOf(id) < 0) needed.push(id);
    });
    if (needed.length) {
      var ol = doc.createElement("ol");
      ol.className = "references";
      needed.forEach(function (id) {
        var src = notes[id], li = doc.createElement("li"), tx = doc.createElement("span");
        li.id = id;
        tx.className = "reference-text";
        Array.prototype.slice.call(src.querySelectorAll("a")).forEach(function (b) { if (hasType(b, /\bbacklink\b/)) b.remove(); });
        var ps = src.querySelectorAll(":scope > p");
        if (ps.length) {
          Array.prototype.forEach.call(ps, function (p, i) {
            if (i) { tx.appendChild(doc.createElement("br")); tx.appendChild(doc.createElement("br")); }
            tx.insertAdjacentHTML("beforeend", p.innerHTML);
          });
        } else tx.innerHTML = src.innerHTML;
        li.appendChild(tx);
        ol.appendChild(li);
      });
      root.appendChild(ol);
    }
    // addresses relative to the file: pictures from the repository, links to the book's other chapters
    root.querySelectorAll("img").forEach(function (img) {
      var u = img.getAttribute("src");
      if (u) try { img.setAttribute("src", new URL(u, base).href); } catch (x) { img.remove(); }
    });
    root.querySelectorAll("a[href]").forEach(function (a) {
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || /^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https?:/i.test(href)) return;
      var u;
      try { u = new URL(href, base); } catch (x) { unwrap(a); return; }
      if (u.href.indexOf(m.base) === 0) {
        var f = m.byFile[u.href.slice(m.base.length).split("#")[0]];
        if (f) a.setAttribute("href", ROOT + LINKED[m.id].path + "/" + f);
        else unwrap(a);
      } else a.setAttribute("href", u.href);
    });
    // the structure: sections give way to the chapter's own flow
    root.querySelectorAll("section, article, header, hgroup, main, aside").forEach(function (e) { unwrap(e); });
    root.querySelectorAll("abbr").forEach(function (e) { if (!e.getAttribute("title")) unwrap(e); });
    root.querySelectorAll("figure").forEach(function (f) { f.className = "fig fig-diagram"; });
    // verse, stage directions, epigraphs and letters
    root.querySelectorAll("[epub\\:type]").forEach(function (e) {
      var t = et(e);
      if (/z3998:(?:verse|poem|song|hymn)\b/.test(t) && /^(BLOCKQUOTE|DIV|TD|SECTION|P)$/.test(e.nodeName)) e.classList.add("pk-poem");
      else if (/stage-direction/.test(t) && /^(P|DIV|TD)$/.test(e.nodeName)) e.classList.add("pk-stage");
      else if (/\bepigraph\b/.test(t)) e.classList.add("pk-epigraph");
      else if (/z3998:(?:letter|salutation|valediction|signature)/.test(t) && /^(P|DIV|BLOCKQUOTE)$/.test(e.nodeName)) e.classList.add("pk-letter");
    });
    // plays: a table of speakers and speeches becomes a list of speeches
    root.querySelectorAll("table").forEach(function (t) {
      if (!t.querySelector('td[epub\\:type~="z3998:persona"], th[epub\\:type~="z3998:persona"]')) return;
      var box = doc.createElement("div");
      box.className = "pk-drama";
      t.querySelectorAll("tr").forEach(function (tr) {
        var cells = tr.querySelectorAll(":scope > td, :scope > th");
        if (!cells.length) return;
        var who = hasType(cells[0], /persona/) ? cells[0] : null;
        var rest = Array.prototype.slice.call(cells, who ? 1 : 0);
        if (who) {
          var sp = doc.createElement("div"), nm = doc.createElement("p"), tx = doc.createElement("div");
          sp.className = "pk-sp"; nm.className = "pk-speaker"; tx.className = "pk-speech";
          nm.innerHTML = who.innerHTML;
          rest.forEach(function (td) { while (td.firstChild) tx.appendChild(td.firstChild); });
          sp.appendChild(nm); sp.appendChild(tx);
          box.appendChild(sp);
        } else {
          var p = doc.createElement("div");
          p.className = "pk-stage";
          rest.forEach(function (td) { while (td.firstChild) p.appendChild(td.firstChild); });
          if (p.textContent.trim() || p.querySelector("img")) box.appendChild(p);
        }
      });
      t.parentNode.replaceChild(box, t);
    });
  }

  /* the chapter's headings: levels from h2, numbered and given the anchors of the contents (from the shell) */
  function shellHeadings(shellRoot) {
    var out = [], hs = shellRoot.querySelectorAll("h2, h3");
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i], t = h.textContent.replace(/¶/g, "").trim(), num = "";
      var mm = /^((?:\d+|[A-Z]|[IVXLC]+)(?:\.\d+)+)\s+(.*)$/.exec(t);
      if (mm) { num = mm[1]; t = mm[2]; }
      out.push({ l: h.nodeName === "H2" ? 2 : 3, t: t, n: num, id: h.id, used: false });
    }
    return out;
  }
  function shiftHeadings(doc, root, firstLevel) {
    var hs = root.querySelectorAll("h1, h2, h3, h4, h5, h6"), min = 7, i;
    for (i = 0; i < hs.length; i++) min = Math.min(min, +hs[i].nodeName.charAt(1));
    if (min === 7) return [];
    var out = [];
    for (i = 0; i < hs.length; i++) {
      var lv = Math.min(6, +hs[i].nodeName.charAt(1) - min + firstLevel);
      var n = hs[i].nodeName === "H" + lv ? hs[i] : replaceTag(doc, hs[i], "h" + lv);
      if (hs[i].id) n.id = hs[i].id;
      out.push(n);
    }
    return out;
  }
  function slug(s, used) {
    var b = String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
    var id = "s-" + b, k = 2;
    while (used[id]) id = "s-" + b + "-" + k++;
    used[id] = 1;
    return id;
  }
  function numberHeadings(doc, hs, shell, c, numbered, ctx) {
    var j = 0, k2 = 0, used = {};
    shell.forEach(function (s) { if (s.id) used[s.id] = 1; });
    hs.forEach(function (h) {
      var lv = +h.nodeName.charAt(1), text = h.textContent.replace(/\s+/g, " ").trim(), nt = norm(text), match = null;
      if (lv <= 3) {
        for (var q = j; q < shell.length; q++) if (!shell[q].used && norm(shell[q].t) === nt) { match = shell[q]; j = q + 1; break; }
      }
      var old = h.id;
      if (match) {
        match.used = true;
        if (match.l !== lv) h = replaceTag(doc, h, "h" + match.l), lv = match.l;
        h.id = match.id;
        if (lv === 2 && match.n) k2 = +String(match.n).split(".").pop() || k2;
      } else {
        h.id = slug(text, used);
      }
      if (old) ctx.idMap[old] = h.id;
      var num = "";
      if (lv === 2 && numbered && c.n) num = match && match.n ? match.n : c.n + "." + (++k2);
      else if (lv === 2 && match && match.n) num = match.n;
      if (num) h.insertBefore(doc.createTextNode(num + " "), h.firstChild);
      var hl = doc.createElement("a");
      hl.className = "headerlink";
      hl.setAttribute("href", "#" + h.id);
      hl.setAttribute("title", "Permanent link");
      hl.textContent = "¶";
      h.appendChild(hl);
    });
  }

  function sourceName(u) {
    if (/gutenberg\.org/.test(u)) return "Project Gutenberg";
    if (/wikisource\.org/.test(u)) return "Wikisource";
    if (/archive\.org/.test(u)) return "the Internet Archive";
    if (/hathitrust|babel\./.test(u)) return "HathiTrust";
    if (/books\.google/.test(u)) return "Google Books";
    return "its source";
  }
  function creditHtmlSE(m, c) {
    var ext = ' target="_blank" rel="noopener noreferrer"';
    var file = "https://github.com/standardebooks/" + m.repo + "/blob/" + (m.branch || "master") + "/src/epub/" + c.page;
    var src = "", from = "";
    (m.sources || []).forEach(function (u) { if (!src && sourceName(u) !== "its source") src = u; });
    if (src) from = "; transcription originally from <a href=\"" + esc(src) + '"' + ext + ">" + esc(sourceName(src)) + "</a>";
    return '<div class="pk-remote-credit" lang="en"><p>From “' + esc(c.t) + "” in <a href=\"" + esc(m.url) + '"' + ext + ">" + esc(m.title) +
      "</a> (" + esc(m.attribution) + "). Standard Ebooks edition (<a href=\"" + esc(file) + '"' + ext + ">source file</a>), <a href=\"" +
      esc(m.licence.url) + '"' + ext + ">" + esc(m.licence.id) + "</a> (public domain dedication)" + from +
      ". Modified: converted to this format.</p></div>";
  }
  function creditHtml(m, c) {
    if (isSE(m)) return creditHtmlSE(m, c);
    if (m.type === "archive") return window.pkScans.credit(m, c);
    var page = m.site + "/wiki/" + encodeURIComponent(c.page.replace(/ /g, "_")).replace(/%2F/g, "/");
    var hist = m.site + "/w/index.php?" + qs([["title", c.page.replace(/ /g, "_")], ["action", "history"]]);
    var ext = ' target="_blank" rel="noopener noreferrer"';
    return '<div class="pk-remote-credit" lang="en"><p>From <a href="' + esc(page) + '"' + ext + ">“" + esc(c.page) + "”</a>" +
      (c.parts ? " and its " + c.parts.length + " pages" : "") + " on " + esc(m.name) + ", by <span class=\"pk-rc-who\">its contributors</span> " +
      '(<a href="' + esc(hist) + '"' + ext + ">page history</a>). Licence: " +
      '<a href="' + esc(m.licence.url) + '"' + ext + ">" + esc(m.licence.id) + "</a>. Modified: converted to this format.</p></div>";
  }

  /* the HTML of a chapter, from the source's answers */
  function convert(m, c, answers, shellRoot) {
    var doc = document.implementation.createHTMLDocument("");
    var root = doc.createElement("div");
    doc.body.appendChild(root);
    var ctx = { notes: {}, nnote: 0, order: [], refSeen: {}, prefix: "", oldIds: {}, idMap: {}, anchors: [], math: false,
                fn: function (k) { return String(k); } };
    var shell = shellHeadings(shellRoot);
    var all = [];
    if (!c.parts) {
      if (isSE(m)) loadSE(doc, root, answers[0], m, c);
      else root.innerHTML = answers[0].parse.text;
      cleanPage(doc, root, m, ctx);
      var hs = shiftHeadings(doc, root, 2);
      var tops = hs.filter(function (h) { return h.nodeName === "H2"; });
      if (tops.length === 1 && hs[0] === tops[0] && norm(tops[0].textContent) === norm(c.t)) {
        tops[0].remove();
        hs = shiftHeadings(doc, root, 2);
      }
      numberHeadings(doc, hs, shell, c, m.numbering, ctx);
    } else {
      // a chapter made of parts (the hymns of a book, ...): one h2 for each part, its own headings below it
      var parts = [];
      answers.forEach(function (a) {
        var tmp = doc.createElement("div");
        tmp.innerHTML = a.parse.text;
        var cur = null;
        Array.prototype.slice.call(tmp.querySelectorAll(".pk-part")).forEach(function (mk) {
          mk.setAttribute("data-pk-mark", "1");
        });
        // walk the top-level nodes (the markers sit at the top level of the parser's output)
        var top = tmp.querySelector(".mw-parser-output") || tmp;
        Array.prototype.slice.call(top.childNodes).forEach(function (n) {
          if (n.nodeType === 1 && n.classList.contains("pk-part")) { cur = { i: +n.getAttribute("data-i"), nodes: [] }; parts.push(cur); return; }
          if (n.nodeType === 1 && n.querySelector && n.querySelector(".pk-part")) {
            // a marker wrapped in a paragraph by the parser
            var mk = n.querySelector(".pk-part");
            cur = { i: +mk.getAttribute("data-i"), nodes: [] };
            parts.push(cur);
            mk.remove();
            if (n.textContent.trim()) cur.nodes.push(n);
            return;
          }
          if (cur) cur.nodes.push(n);
        });
      });
      parts.sort(function (a, b) { return a.i - b.i; });
      parts.forEach(function (p) {
        var info = c.parts[p.i];
        if (!info) return;
        var sec = doc.createElement("div");
        p.nodes.forEach(function (n) { sec.appendChild(n); });
        ctx.prefix = "p" + (p.i + 1) + "-";
        cleanPage(doc, sec, m, ctx);
        var hs = shiftHeadings(doc, sec, 3);
        hs.forEach(function (h) { var old = h.id; h.id = info.id + "-" + slug(h.textContent, {}).slice(2); if (old) ctx.idMap[old] = h.id; });
        var h2 = doc.createElement("h2");
        h2.id = info.id;
        h2.textContent = info.t;
        var hl = doc.createElement("a");
        hl.className = "headerlink"; hl.setAttribute("href", "#" + info.id); hl.setAttribute("title", "Permanent link"); hl.textContent = "¶";
        h2.appendChild(hl);
        root.appendChild(h2);
        while (sec.firstChild) root.appendChild(sec.firstChild);
      });
    }
    // anchors within the chapter
    ctx.anchors.forEach(function (a) {
      var id = decodeURIComponent(a.getAttribute("href").slice(1));
      if (ctx.idMap[id]) a.setAttribute("href", "#" + ctx.idMap[id]);
      else if (!root.querySelector('[id="' + id.replace(/"/g, '\\"') + '"]')) a.removeAttribute("href");
    });
    // the footnotes, at the end, as the other books have them
    if (ctx.order.length) {
      var fdiv = doc.createElement("div");
      fdiv.className = "footnote";
      var ol = doc.createElement("ol");
      ctx.order.forEach(function (o) {
        var li = doc.createElement("li");
        li.id = "fn:" + ctx.fn(o.k);
        var p = doc.createElement("p");
        if (o.node) { stripAttrs(o.node, ctx); while (o.node.firstChild) p.appendChild(o.node.firstChild); }
        var back = doc.createElement("a");
        back.className = "footnote-backref";
        back.setAttribute("href", "#fnref:" + ctx.fn(o.k));
        back.setAttribute("title", "Back to the text");
        back.textContent = "↩";
        p.appendChild(doc.createTextNode(" "));
        p.appendChild(back);
        li.appendChild(p);
        ol.appendChild(li);
      });
      fdiv.appendChild(doc.createElement("hr"));
      fdiv.appendChild(ol);
      root.appendChild(fdiv);
    }
    // ids that nothing uses any more
    Object.keys(ctx.oldIds).forEach(function (id) {
      var e = ctx.oldIds[id];
      if (e && e.id === id && !/^H[1-6]$/.test(e.nodeName) && !root.querySelector('a[href="#' + id.replace(/"/g, '\\"') + '"]')) e.removeAttribute("id");
    });
    return { html: root.innerHTML, math: ctx.math || !!root.querySelector(".arithmatex") };
  }

  /* ---------------------------------------------------------------- filling a shell */
  function statusHtml(state, m, id) {
    var name = esc(m ? m.name : (LINKED[id] && LINKED[id].name) || "its source");
    if (state === "loading") {
      return '<div class="pk-remote-status" role="status"><span class="pk-spin" aria-hidden="true"></span>' +
        "<span>Fetching this chapter from " + name + "…</span></div>";
    }
    var off = !online();
    return '<div class="pk-remote-status pk-remote-fail" role="alert"><p><strong>This chapter could not be fetched from ' + name + ".</strong></p><p>" +
      (off ? "You are offline. A linked book opens without a connection once it has been kept for offline reading on this device."
           : "The site did not answer. Check the connection and try again.") +
      '</p><p><button type="button" class="pk-btn pk-btn-quiet pk-remote-retry">Try again</button></p></div>';
  }

  /* fetch and convert one chapter: resolves with {html, math, m, c} */
  function chapterHtml(id, page, shellRoot) {
    return bookMeta(id).then(function (m) {
      var c = chapterOf(m, page);
      if (!c) throw new Error("unknown chapter");
      if (m.type === "archive") return window.pkScans.chapter(m, c, shellRoot);     // a scanned book: assets/scans.js
      var load = isSE(m) ? getText(m.base + c.page).then(function (t) {
        return (m.notes && /noteref/.test(t) ? getText(m.base + m.notes) : Promise.resolve("")).then(function (n) { return [{ xhtml: t, notes: n }]; });
      }) : Promise.all(textUrls(m, c).map(getJSON));
      return load.then(function (answers) {
        var out = convert(m, c, answers, shellRoot);
        out.m = m; out.c = c;
        return out;
      });
    });
  }

  function fillShell(el) {
    if (!el || el.getAttribute("data-state") === "busy") return Promise.resolve(false);
    var id = el.getAttribute("data-book"), page = el.getAttribute("data-page");
    if (!LINKED[id]) return Promise.resolve(false);
    var article = el.parentNode;
    el.setAttribute("data-state", "busy");
    el.innerHTML = statusHtml("loading", null, id);
    var t0 = performance.now ? performance.now() : Date.now();
    return chapterHtml(id, page, article).then(function (out) {
      // the shell's section headings give way to the chapter's own
      var n = el.nextSibling;
      while (n) { var nx = n.nextSibling; article.removeChild(n); n = nx; }
      var box = document.createElement("div");
      box.className = "pk-remote-text";
      box.setAttribute("data-book", id);
      box.setAttribute("data-page", page);
      box.setAttribute("lang", el.getAttribute("lang") || "en");
      box.innerHTML = out.html + creditHtml(out.m, out.c);
      article.replaceChild(box, el);
      try { window.__pkRemoteMs = Math.round((performance.now ? performance.now() : Date.now()) - t0); } catch (x) { /* ignore */ }
      who(out.m, out.c, box);
      return { root: box, math: out.math, m: out.m, c: out.c };
    }, function (err) {
      el.setAttribute("data-state", "failed");
      el.innerHTML = statusHtml("failed", null, id);
      el.__pkErr = err;
      return null;
    });
  }

  /* the contributors' names in the attribution (when the source gives them) */
  function who(m, c, box) {
    if (isSE(m)) return;
    if (m.type === "archive") return;
    getJSON(creditUrl(m, c)).then(function (j) {
      var p = j.query && j.query.pages && j.query.pages[0], names = (p && p.contributors || []).map(function (x) { return x.name; });
      if (!names.length) return;
      var more = (p.anoncontributors || 0) + (j["continue"] ? 1 : 0);
      var s = "its contributors, among them " + names.slice(0, 6).join(", ") + (names.length > 6 || more ? " and others" : "");
      var span = box.querySelector(".pk-rc-who");
      if (span) span.textContent = s;
    }).catch(noop);
  }

  function announce(res) {
    try { document.dispatchEvent(new CustomEvent("pk:remote-filled", { detail: { book: res.m.id, page: res.c.page, root: res.root } })); } catch (x) { /* old browsers */ }
  }
  /* the reader puts a filled chapter into its pages itself: announce it when it arrives there */
  if (window.MutationObserver) {
    new MutationObserver(function (list) {
      list.forEach(function (mu) {
        Array.prototype.forEach.call(mu.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches(".book-cover, [data-vol]") || n.querySelector(".book-cover")) badgeCovers(n.parentNode || n);
          var t = n.classList.contains("pk-remote-text") ? n : n.querySelector && n.querySelector(".pk-remote-text");
          if (t && t.closest(".rd-flow")) announce({ m: { id: t.getAttribute("data-book") }, c: { page: t.getAttribute("data-page") }, root: t });
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* fill the shells inside an element (the page's article, or the reader's page) */
  function fill(scope) {
    var shells = (scope || document).querySelectorAll(".pk-remote[data-book]:not([data-state=busy])");
    return Promise.all(Array.prototype.map.call(shells, function (el) {
      return fillShell(el).then(function (res) {
        if (!res) return null;
        var live = document.contains(res.root);
        var done = res.math && live && window.bjpMath ? window.bjpMath.typeset([res.root]) : Promise.resolve();
        return Promise.resolve(done).then(function () {
          if (live && !res.root.closest(".rd-flow")) {
            // the place the address points to has only now arrived
            // (the address the page was opened with: the theme rewrites the address as the reader scrolls)
            var want = wantHash || location.hash;
            wantHash = "";
            var h = want && want.length > 1 ? document.getElementById(decodeURIComponent(want.slice(1))) : null;
            if (h && res.root.contains(h)) h.scrollIntoView();
            announce(res);
          }
          return res;
        });
      });
    }));
  }

  /* for the reader: a chapter record ({html, url, ...}) whose HTML holds a shell, with the chapter put in */
  function fillRec(rec) {
    if (!rec || rec.html.indexOf("pk-remote") < 0) return Promise.resolve(rec);
    var box = document.createElement("div");
    box.innerHTML = rec.html;
    if (!box.querySelector(".pk-remote[data-book]")) return Promise.resolve(rec);
    // a shell cloned from a page that was still filling it (the reader reopens at once): start it afresh
    box.querySelectorAll(".pk-remote[data-state]").forEach(function (e) { e.removeAttribute("data-state"); if (!e.querySelector(".pk-remote-text")) e.innerHTML = ""; });
    return fill(box).then(function (res) {
      var out = {};
      Object.keys(rec).forEach(function (k) { out[k] = rec[k]; });
      out.html = box.innerHTML;
      out.remoteError = !res.length || res.some(function (r) { return !r; });
      return out;
    });
  }

  /* "Try again" */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".pk-remote-retry");
    if (!b) return;
    var el = b.closest(".pk-remote");
    if (!el) return;
    e.preventDefault();
    el.removeAttribute("data-state");
    var inReader = !!el.closest(".rd-flow");
    fill(el.parentNode).then(function () {
      if (inReader) { try { window.dispatchEvent(new Event("resize")); } catch (x) { /* ignore */ } }
    });
  });

  /* ---------------------------------------------------------------- the badge on the covers of the linked books */
  function badgeCovers(scope) {
    Object.keys(LINKED).forEach(function (id) {
      (scope || document).querySelectorAll('[data-vol="' + id + '"] .book-cover, .book-cover[data-vol="' + id + '"]').forEach(function (cv) {
        if (cv.querySelector(".pk-cover-badge")) return;
        var b = document.createElement("span");
        b.className = "pk-cover-badge";
        b.textContent = LINKED[id].badge;
        cv.appendChild(b);
      });
    });
  }

  /* ---------------------------------------------------------------- the page of a book: its badge and the offline copy */
  function bookPage(id) {
    var hero = document.querySelector('.pk-book[data-vol="' + id + '"]');
    if (!hero) return;
    var by = hero.querySelector(".pk-book-by");
    if (by && !hero.querySelector(".pk-linked-tag")) {
      var tag = document.createElement("p");
      tag.className = "pk-linked-tag";
      tag.textContent = LINKED[id].badge;
      by.parentNode.insertBefore(tag, by.nextSibling);
    }
    var box = hero.querySelector('.bjp-offline[data-vol="' + id + '"]');
    if (!box || box.__pkWatch || !window.MutationObserver) return;
    box.__pkWatch = true;
    var last = "";
    new MutationObserver(function () {
      var s = (/is-(\w+)/.exec(box.className) || [])[1] || "";
      if (s !== last) { last = s; if (s === "kept" || s === "none" || s === "idle") syncKept(id); }
    }).observe(box, { attributes: true, attributeFilter: ["class"] });
  }
  function keepLine(id, text) {
    var hero = document.querySelector('.pk-book[data-vol="' + id + '"]');
    var box = hero && hero.querySelector('.bjp-offline[data-vol="' + id + '"]');
    if (!box) return;
    var p = hero.querySelector(".pk-remote-keep");
    if (!p) {
      p = document.createElement("p");
      p.className = "pk-remote-keep";
      p.setAttribute("role", "status");
      box.parentNode.insertBefore(p, box.nextSibling);
    }
    p.textContent = text;
    p.hidden = !text;
  }

  var CAN_KEEP = !!(window.caches && window.fetch && "serviceWorker" in navigator && window.isSecureContext);
  var jobs = {};
  function indexKey(id) { return META + "remote-" + id; }
  /* keep (or drop) the source's answers so that they follow the book's offline state, which assets/app.js records */
  function syncKept(id) {
    if (!CAN_KEEP || jobs[id] || LINKED[id].type === "archive") return;     // scanned books are kept by assets/scans.js
    Promise.all([caches.open(KEEP).then(function (c) { return c.match(META + id); }), caches.open(KEPT)]).then(function (r) {
      var kept = r[0], cache = r[1];
      return cache.match(indexKey(id)).then(function (ix) { return ix ? ix.json() : null; }).then(function (index) {
        if (!kept) { if (index) return drop(id, cache, index); keepLine(id, ""); return null; }
        return kept.json().then(function (km) {
          if (index && index.hash === km.hash && index.complete) {
            keepLine(id, "The chapters' text from " + LINKED[id].name + " is kept on this device as well.");
            return null;
          }
          if (!online()) return null;
          return keepAll(id, cache, km.hash);
        });
      });
    }).catch(noop);
  }
  function drop(id, cache, index) {
    return Promise.all((index.urls || []).map(function (u) { return cache.delete(u); })).then(function () {
      return cache.delete(indexKey(id));
    }).then(function () { keepLine(id, ""); });
  }
  function imagesOf(json) {
    var out = [], re = /\s(?:src|srcset)="([^"]+)"/g, mm, t = json && json.parse && json.parse.text || "";
    while ((mm = re.exec(t))) {
      mm[1].replace(/&amp;/g, "&").split(",").forEach(function (s) {
        var u = s.trim().split(/\s+/)[0];
        if (/^(https?:)?\/\/(upload|thumb)\.wikimedia\.org\//.test(u) && !/mwe-math|\/math\/render\//.test(u)) out.push(u);
      });
    }
    return out;
  }
  function imagesOfSE(text, fileUrl) {
    var out = [], re = /<img\b[^>]*?\ssrc="([^"]+)"/g, mm;
    while ((mm = re.exec(text))) { try { out.push(new URL(mm[1], fileUrl).href); } catch (x) { /* ignore */ } }
    return out;
  }
  function keepAll(id, cache, hash) {
    var job = jobs[id] = { done: 0, total: 0 };
    return bookMeta(id).then(function (m) {
      var urls = [];
      m.chapters.forEach(function (c) { urls = urls.concat(textUrls(m, c)); if (!isSE(m)) urls.push(creditUrl(m, c)); });
      if (isSE(m) && m.notes) urls.push(m.base + m.notes);
      job.total = urls.length;
      var stored = [], failed = 0, i = 0, imgs = [];
      function line() { keepLine(id, "Keeping the chapters' text from " + m.name + "… " + job.done + " of " + job.total); }
      line();
      function put(u, opts) {
        return fetch(u, opts || { credentials: "omit", mode: "cors" }).then(function (res) {
          if (!res.ok && res.type !== "opaque") throw new Error("http " + res.status);
          var copy = res.clone();
          return cache.put(u, copy).then(function () { stored.push(u); return res; });
        });
      }
      function worker() {
        if (i >= urls.length) return Promise.resolve();
        var u = urls[i++];
        return put(u).then(function (res) {
          var list = isSE(m) ? res.text().then(function (t) { return imagesOfSE(t, u); }) : res.json().then(imagesOf);
          return list.then(function (l) { l.forEach(function (x) { x = cleanImgUrl(m, x); if (imgs.indexOf(x) < 0) imgs.push(x); }); }).catch(noop);
        }).catch(function () { failed++; }).then(function () { job.done++; line(); return worker(); });
      }
      var ws = [];
      for (var k = 0; k < 3; k++) ws.push(worker());
      return Promise.all(ws).then(function () {
        job.total += imgs.length;
        var j2 = 0;
        function iw() {
          if (j2 >= imgs.length) return Promise.resolve();
          var u = imgs[j2++];
          return put(u).catch(function () { return put(u, { mode: "no-cors" }).catch(noop); }).then(function () { job.done++; line(); return iw(); });
        }
        return Promise.all([iw(), iw(), iw()]);
      }).then(function () {
        var index = { id: id, hash: hash, t: Date.now(), urls: stored, complete: !failed };
        return cache.put(indexKey(id), new Response(JSON.stringify(index), { headers: { "Content-Type": "application/json" } })).then(function () {
          keepLine(id, failed ? failed + " chapters' text could not be kept; it will be tried again." :
            "The chapters' text from " + m.name + " is kept on this device as well.");
        });
      });
    }).catch(function () { keepLine(id, ""); }).then(function () { delete jobs[id]; });
  }

  /* ---------------------------------------------------------------- every page */
  function onPage() {
    var id = bookOfPath(location.pathname);
    document.documentElement.classList.toggle("pk-linked", !!id);
    badgeCovers(document);
    if (!id) return;
    bookPage(id);
    var art = document.querySelector("article.md-content__inner");
    if (art && art.querySelector(".pk-remote[data-book]")) { wantHash = location.hash; fill(art); }
    if (online()) setTimeout(function () { syncKept(id); }, 1500);
  }

  window.pkRemote = { fill: fill, fillRec: fillRec, books: LINKED, keep: syncKept };
  if (window.document$ && window.document$.subscribe) window.document$.subscribe(onPage);
  else if (document.readyState !== "loading") onPage();
  else document.addEventListener("DOMContentLoaded", onPage);
})();
