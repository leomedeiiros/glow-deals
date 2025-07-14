// frontend/src/components/LinkForm.js
import React, { useState, useEffect } from 'react';

const LinkForm = ({ recentLinks = [] }) => {
  const [url, setUrl] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  useEffect(() => {
    const input = document.querySelector('.form-input');
    if (input) {
      input.classList.add('animate-in');
      setTimeout(() => {
        input.classList.remove('animate-in');
      }, 500);
    }
  }, []);
  
  const handleChange = (e) => {
    setUrl(e.target.value);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };
  
  return (
    <div className={`input-clear-wrapper ${isFocused ? 'focused' : ''}`}>
      <input
        type="url"
        className="form-input"
        value={url}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="https://mercadolivre.com/sec/ZXorKJ3"
        list="url-history"
      />
      {recentLinks && recentLinks.length > 0 && (
        <datalist id="url-history">
          {recentLinks.map((link, index) => (
            <option key={index} value={link} />
          ))}
        </datalist>
      )}
      {url && (
        <button 
          className="clear-input-btn" 
          onClick={() => setUrl('')}
          type="button"
          aria-label="Limpar campo"
        >
          <i className="fas fa-times"></i>
        </button>
      )}
    </div>
  );
};

export default LinkForm;