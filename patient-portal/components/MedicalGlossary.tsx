/**
 * @fileoverview Medical Glossary Component
 * 
 * A comprehensive, searchable medical glossary component that provides
 * patient-friendly explanations of medical terms with multilingual support.
 * 
 * Features:
 * - Searchable medical term database
 * - Category-based filtering
 * - Plain language explanations
 * - Audio pronunciation support
 * - Accessibility compliance
 * - Multilingual support
 * - Related terms navigation
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MedicalGlossaryTerm,
  GlossaryCategory,
  GlossarySearchResponse,
  MedicalGlossaryProps
} from '../types/reports';

/**
 * MedicalGlossary Component
 * 
 * Provides a searchable interface for medical terms with patient-friendly explanations
 */
export const MedicalGlossary: React.FC<MedicalGlossaryProps> = ({
  searchTerm = '',
  category,
  language,
  onTermSelect,
  className = '',
  embedded = false
}) => {
  const { t, i18n } = useTranslation();
  
  // Component state
  const [terms, setTerms] = useState<MedicalGlossaryTerm[]>([]);
  const [categories, setCategories] = useState<GlossaryCategory[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<MedicalGlossaryTerm | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(category || 'all');
  const [searchQuery, setSearchQuery] = useState(searchTerm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [totalTerms, setTotalTerms] = useState(0);

  /**
   * Load terms from the API
   */
  const loadTerms = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        language: language || i18n.language,
        _count: '100'
      });

      if (activeCategory !== 'all') {
        params.append('category', activeCategory);
      }

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`/api/glossary/medical-terms?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to load glossary terms');
      }

      const data: GlossarySearchResponse = await response.json();
      setTerms(data.terms);
      setCategories(data.categories);
      setTotalTerms(data.total);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to load glossary terms:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, searchQuery, language, i18n.language]);

  /**
   * Handle term selection
   */
  const handleTermSelect = (term: MedicalGlossaryTerm) => {
    setSelectedTerm(term);
    onTermSelect?.(term);

    // Log access for audit purposes
    console.log(`Glossary term selected: ${term.id} at ${new Date().toISOString()}`);
  };

  /**
   * Play audio pronunciation for a term
   */
  const playAudio = async (term: MedicalGlossaryTerm) => {
    if (playingAudio === term.id) {
      // Stop current audio
      speechSynthesis.cancel();
      setPlayingAudio(null);
      return;
    }

    try {
      setPlayingAudio(term.id);

      if (term.audioUrl) {
        // Use provided audio URL
        const audio = new Audio(term.audioUrl);
        audio.onended = () => setPlayingAudio(null);
        audio.onerror = () => {
          setPlayingAudio(null);
          // Fallback to speech synthesis
          speakTerm(term);
        };
        await audio.play();
      } else {
        // Use browser speech synthesis
        speakTerm(term);
      }

      // Log audio access for audit purposes
      console.log(`Audio requested for term: ${term.id}`);

    } catch (error) {
      console.error('Failed to play audio:', error);
      setPlayingAudio(null);
    }
  };

  /**
   * Use speech synthesis to pronounce a term
   */
  const speakTerm = (term: MedicalGlossaryTerm) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(term.term);
      utterance.lang = language || i18n.language;
      utterance.rate = 0.8;
      utterance.pitch = 1;
      
      utterance.onend = () => setPlayingAudio(null);
      utterance.onerror = () => setPlayingAudio(null);
      
      speechSynthesis.speak(utterance);
    } else {
      setPlayingAudio(null);
    }
  };

  /**
   * Clear search and filters
   */
  const clearSearch = () => {
    setSearchQuery('');
    setActiveCategory('all');
  };

  /**
   * Handle category change
   */
  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
  };

  // Load terms when dependencies change
  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  // Update search query when prop changes
  useEffect(() => {
    setSearchQuery(searchTerm);
  }, [searchTerm]);

  // Update category when prop changes
  useEffect(() => {
    if (category) {
      setActiveCategory(category);
    }
  }, [category]);

  // Sort terms alphabetically
  const sortedTerms = useMemo(() => {
    return [...terms].sort((a, b) => a.term.localeCompare(b.term));
  }, [terms]);

  return (
    <div className={`medical-glossary ${embedded ? 'embedded' : ''} ${className}`}>
      {/* Header */}
      {!embedded && (
        <div className="glossary-header">
          <h2>{t('glossary.medical_title')}</h2>
          <p>{t('glossary.medical_description')}</p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="glossary-controls">
        <div className="search-section">
          <div className="search-box">
            <label htmlFor="glossary-search" className="sr-only">
              {t('glossary.search_placeholder')}
            </label>
            <input
              id="glossary-search"
              type="text"
              placeholder={t('glossary.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-describedby="search-help"
            />
            <button 
              className="search-button"
              onClick={loadTerms}
              aria-label={t('glossary.search_button')}
            >
              🔍
            </button>
          </div>
          <p id="search-help" className="search-help">
            {t('glossary.search_help')}
          </p>
        </div>

        <div className="category-filters">
          <h3>{t('glossary.categories')}</h3>
          <div className="category-buttons">
            <button
              className={`category-button ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('all')}
            >
              {t('glossary.all_categories')} ({totalTerms})
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`category-button ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat.id)}
                title={cat.description}
              >
                {t(`glossary.category_${cat.id}`, cat.name)} ({cat.termCount})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glossary-content">
        {/* Loading State */}
        {isLoading && (
          <div className="loading-state">
            <div className="loading-spinner" aria-label={t('glossary.loading')} />
            <p>{t('glossary.loading')}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <h3>{t('glossary.error_title')}</h3>
            <p>{error}</p>
            <button onClick={loadTerms} className="retry-button">
              {t('glossary.retry')}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && sortedTerms.length === 0 && (
          <div className="empty-state">
            <h3>{t('glossary.no_terms_found')}</h3>
            <p>{t('glossary.no_terms_message')}</p>
            {(searchQuery || activeCategory !== 'all') && (
              <button onClick={clearSearch} className="clear-button">
                {t('glossary.clear_search')}
              </button>
            )}
          </div>
        )}

        {/* Terms List */}
        {!isLoading && !error && sortedTerms.length > 0 && (
          <div className="terms-container">
            <div className="terms-list">
              <h3>{t('glossary.terms_list')} ({sortedTerms.length})</h3>
              {sortedTerms.map(term => (
                <div
                  key={term.id}
                  className={`term-item ${selectedTerm?.id === term.id ? 'selected' : ''}`}
                >
                  <div className="term-header">
                    <button
                      className="term-name-button"
                      onClick={() => handleTermSelect(term)}
                    >
                      <h4 className="term-name">{term.term}</h4>
                    </button>
                    <button
                      className="audio-button"
                      onClick={() => playAudio(term)}
                      disabled={!('speechSynthesis' in window) && !term.audioUrl}
                      aria-label={t('glossary.pronounce_term', { term: term.term })}
                      title={t('glossary.pronounce_term', { term: term.term })}
                    >
                      {playingAudio === term.id ? '⏸️' : '🔊'}
                    </button>
                  </div>
                  
                  <div className="term-preview">
                    <p className="plain-language">{term.plainLanguage}</p>
                    {term.normalRange && (
                      <p className="normal-range">
                        <strong>{t('glossary.normal_range')}:</strong> {term.normalRange}
                      </p>
                    )}
                  </div>

                  {term.category && (
                    <div className="term-category">
                      <span className="category-tag">
                        {t(`glossary.category_${term.category}`, term.category)}
                      </span>
                    </div>
                  )}

                  {term.examples && term.examples.length > 0 && (
                    <div className="term-examples">
                      <strong>{t('glossary.examples')}:</strong> {term.examples.slice(0, 2).join(', ')}
                      {term.examples.length > 2 && '...'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Term Details Panel */}
            {selectedTerm && !embedded && (
              <div className="term-details-panel">
                <div className="details-header">
                  <h3>{selectedTerm.term}</h3>
                  <button
                    className="close-details"
                    onClick={() => setSelectedTerm(null)}
                    aria-label={t('glossary.close_details')}
                  >
                    ✕
                  </button>
                </div>

                <div className="details-content">
                  <div className="definition-section">
                    <h4>{t('glossary.medical_definition')}</h4>
                    <p>{selectedTerm.definition}</p>
                  </div>

                  <div className="plain-language-section">
                    <h4>{t('glossary.simple_explanation')}</h4>
                    <p>{selectedTerm.plainLanguage}</p>
                  </div>

                  {selectedTerm.normalRange && (
                    <div className="normal-range-section">
                      <h4>{t('glossary.normal_range')}</h4>
                      <p>{selectedTerm.normalRange}</p>
                    </div>
                  )}

                  {selectedTerm.examples && selectedTerm.examples.length > 0 && (
                    <div className="examples-section">
                      <h4>{t('glossary.examples')}</h4>
                      <ul>
                        {selectedTerm.examples.map((example, index) => (
                          <li key={index}>{example}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedTerm.relatedTerms && selectedTerm.relatedTerms.length > 0 && (
                    <div className="related-terms-section">
                      <h4>{t('glossary.related_terms')}</h4>
                      <div className="related-terms">
                        {selectedTerm.relatedTerms.map(relatedId => {
                          const relatedTerm = terms.find(t => t.id === relatedId);
                          return relatedTerm ? (
                            <button
                              key={relatedId}
                              className="related-term-button"
                              onClick={() => handleTermSelect(relatedTerm)}
                            >
                              {relatedTerm.term}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {selectedTerm.imageUrl && (
                    <div className="image-section">
                      <img
                        src={selectedTerm.imageUrl}
                        alt={selectedTerm.term}
                        className="term-image"
                      />
                    </div>
                  )}

                  <div className="term-meta">
                    <p className="last-updated">
                      {t('glossary.last_updated')}: {new Date(selectedTerm.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalGlossary;