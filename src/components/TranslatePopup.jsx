import React, { useState, useEffect } from 'react';
import './TranslatePopup.css';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logo from '../assets/explified.png';
import icon from '../assets/pen-nib (1).png'
const ai = new GoogleGenerativeAI('AIzaSyAa4Gw5CzAu7whpIrRcpHUWLPBR6VeMkyE'); // Replace with your actual Gemini API key

const languages = [
  'English','Hindi', 'Bengali', 'Urdu', 'Punjabi', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Malayalam',
  'Kannada', 'Odia', 'Assamese', 'Konkani', 'Manipuri', 'Nepali', 'Bodo', 'Dogri', 'Kashmiri',
  'Santali', 'Sindhi', 'Maithili', 'Sanskrit'
];

const languageCodeMap = {
  English: 'en',
  Hindi: 'hi',
  Bengali: 'bn',
  Urdu: 'ur',
  Punjabi: 'pa',
  Tamil: 'ta',
  Telugu: 'te',
  Marathi: 'mr',
  Gujarati: 'gu',
  Malayalam: 'ml',
  Kannada: 'kn',
  Odia: 'or',
  Assamese: 'as',
  Konkani: 'kok',     // ISO 639-2
  Manipuri: 'mni',   // Meitei (Manipuri) - ISO 639-3
  Nepali: 'ne',
  Bodo: 'brx',        // ISO 639-3
  Dogri: 'doi',       // ISO 639-3
  Kashmiri: 'ks',
  Santali: 'sat',     // ISO 639-2
  Sindhi: 'sd',
  Maithili: 'mai',    // ISO 639-2
  Sanskrit: 'sa'
};

const reverseLanguageCodeMap = Object.fromEntries(
  Object.entries(languageCodeMap).map(([lang, code]) => [code.toLowerCase(), lang])
);

const TranslatePopup = () => {
  const [fromLang, setFromLang] = useState('Detect language');
  const [toLang, setToLang] = useState('English');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [magicInput, setMagicInput] = useState('');
  const [magicType, setMagicType] = useState('Default');
  const [magicOutputs, setMagicOutputs] = useState([]);
  const [showPopup, setShowPopup] = useState(true);
  const [currentView, setCurrentView] = useState('translator-input');
  const [viewHistory, setViewHistory] = useState(['translator-input']);
  useEffect(() => {
  chrome.storage?.local.get(['selectedText', 'mode'], (result) => {
    if (result?.selectedText) {
      setInputText(result.selectedText);
      setMagicInput(result.selectedText);

      if (result.mode === 'magic') {
        setCurrentView('magic-input');
      } else {
        setCurrentView('translator-input');
      }

      // Clean up storage
      chrome.storage.local.remove(['selectedText', 'mode']);
    }
  });
}, []);

  const goToView = (viewName) => {
    setCurrentView(viewName);
    setViewHistory(prev => [...prev, viewName]);
  };

  const goBack = () => {
    setViewHistory(prev => {
      if (prev.length <= 1) return prev;
      const newHistory = prev.slice(0, -1);
      setCurrentView(newHistory[newHistory.length - 1]);
      return newHistory;
    });
  };

  const detectLanguage = async (text) => {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Detect the language of this text and return ONLY the ISO 639-1 code (like en, hi, fr):\n\n"${text}"`;
    const result = await model.generateContent([prompt]);
    const response = await result.response;
    return (await response.text()).trim().toLowerCase();
  };

  const translateText = async (text, targetLang) => {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Translate the following text into ${targetLang}. Return ONLY the translated text:\n\n${text}`;
    const result = await model.generateContent([prompt]);
    const response = await result.response;
    return (await response.text()).trim();
  };

  const runTranslation = async () => {
    if (!inputText.trim()) return;
    try {
      const detectedCode = await detectLanguage(inputText);
      const detectedLang = reverseLanguageCodeMap[detectedCode] || 'Detect language';
      setFromLang(detectedLang);

      const translated = await translateText(inputText, toLang);
      setOutputText(translated);
    } catch (err) {
      console.error('Translation error:', err);
      setOutputText('Translation failed.');
    }
  };

 // Debounced translation logic
useEffect(() => {
  if (currentView !== 'translator-input') return;
  if (!inputText.trim()) {
    setOutputText('');
    return;
  }

  const handler = setTimeout(() => {
    runTranslation();
  }, 1000); // Wait 1 second after typing stops

  return () => {
    clearTimeout(handler); // Clear timeout if user types again
  };
}, [inputText, toLang]);


  const handleMagicSubmit = async () => {
    if (!magicInput.trim()) return;
    setMagicOutputs([]);
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let stylePrompt = '';
    switch (magicType) {
      case 'Hummanize':
        stylePrompt = 'in very simple, casual language anyone can understand';
        break;
      case 'Textbook':
        stylePrompt = 'in formal, academic textbook-style language';
        break;
      default:
        stylePrompt = 'clearly in natural English';
    }

    const prompt = `
Explain the following text ${stylePrompt}.

Text:
"""
${magicInput}
"""

Give 3 *different* versions of the explanation. Number them clearly like this:
1. ...
2. ...
3. ...
`.trim();

    try {
      const result = await model.generateContent([prompt]);
      const response = await result.response;
      const fullText = (await response.text()).trim();

      const outputs = fullText
        .split(/\n?\d\.\s/)
        .filter(Boolean)
        .map(o => o.trim())
        .slice(0, 3);

      setMagicOutputs(outputs.length < 3 ? [fullText] : outputs);
      goToView('magic-output');
    } catch (err) {
      console.error('Magic pen error:', err);
      setMagicOutputs(['Failed to generate content. Please try again.']);
      goToView('magic-output');
    }
  };

  if (!showPopup) {
    return (
      <div className="floating-bubble" onClick={() => setShowPopup(true)}>
        <img src={logo} alt="Translate +" style={{ width: '30px', height: '30px' }} />
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <button className="back-button" onClick={goBack}>&larr;</button>
        <span className="popup-title"><img src={logo} alt="logo" />Translate +</span>
        <span className="settings-icon">&#9881;</span>
      </div>

      <div className="mode-toggle">
        <button className={currentView.startsWith('translator') ? 'active' : ''} onClick={() => goToView('translator-input')}>Translator</button>
        <button className={currentView.startsWith('magic') ? 'active' : ''} onClick={() => goToView('magic-input')}>Magic Pen</button>
      </div>

      {currentView === 'translator-input' && (
        <>
        <br/>
          <div className="language-select">
            <select value={fromLang} onChange={e => setFromLang(e.target.value)}>
              <option>Detect language</option>
              {languages.map(lang => <option key={lang}>{lang}</option>)}
            </select>
            <span className="arrow">→</span>
            <select value={toLang} onChange={e => setToLang(e.target.value)}>
              {languages.map(lang => <option key={lang}>{lang}</option>)}
            </select>
          </div>
           <br/>
          <textarea
  className="translate-input"
  value={inputText}
  onChange={(e) => setInputText(e.target.value)}
  placeholder="Type or paste your large text to translate..."
/>
<p>&darr;</p>


          <textarea
            className="translate-output"
            value={outputText}
            placeholder='Get the translation here'
            readOnly
          />
        </>
      )}

      {currentView === 'magic-input' && (
        <div className="magicpen-view">
          <br/>
          <div className="magic-icon"><img src={icon} alt="" className='icon'/></div>
          <div className="magic-text">Let me know, I’ll improvise!</div>
          <div className="magic-controls">
            <select value={toLang} onChange={e => setToLang(e.target.value)}>
              {languages.map(lang => <option key={lang}>{lang}</option>)}
            </select>
            <select value={magicType} onChange={e => setMagicType(e.target.value)}>
              <option value="Default">Default</option>
              <option value="Hummanize">Hummanize</option>
              <option value="Textbook">Textbook</option>
            </select>
          </div>

          <textarea
            className="translate-input"
            value={magicInput}
            onChange={e => setMagicInput(e.target.value)}
            placeholder="Type here"
          />

          <button className="submit-btn" onClick={handleMagicSubmit}>Submit →</button>
        </div>
      )}

      {currentView === 'magic-output' && (
        <div className="magic-output-popup">
          <div className="magic-output-container">
            {magicOutputs.map((text, index) => (
  <div className="output-block" key={index}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <strong>Output {index + 1}:</strong>
      <button
        className="copy-btn"
        onClick={() => navigator.clipboard.writeText(text)}
        style={{ padding: '2px 8px', fontSize: '0.8rem', cursor: 'pointer' }}
      >
        Copy
      </button>
    </div>
    <div className="magic-output-box">{text}</div>
  </div>
))}

          </div>
         
          <div className="magic-btn-group myout">
            <br />
            <button onClick={() => goToView('magic-input')}>Anything else?</button>
          </div>
        </div>
      )}

      <div className="toggle-section">
        <label>Show floating Translate + icon</label>
        <label className="switch">
          <input type="checkbox" onChange={() => setShowPopup(false)} />
          <span className="slider round"></span>
        </label>
      </div>
    </div>
  );
};

export default TranslatePopup;
