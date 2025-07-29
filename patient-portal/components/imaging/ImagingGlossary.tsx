/**
 * @fileoverview Multilingual Imaging Glossary Component
 * 
 * Provides multilingual definitions and explanations for medical imaging terminology
 * to improve patient health literacy and understanding.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Types for glossary
export interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  definition: string;
  plainLanguage: string;
  examples?: string[];
  relatedTerms?: string[];
  audioUrl?: string;
  imageUrl?: string;
}

export interface GlossaryCategory {
  id: string;
  name: string;
  description: string;
  termCount: number;
}

interface ImagingGlossaryProps {
  searchTerm?: string;
  category?: string;
  language?: string;
  onTermSelect?: (term: GlossaryTerm) => void;
  className?: string;
}

/**
 * Sample imaging terms data structure
 * In production, this would come from an API with full multilingual support
 */
const SAMPLE_TERMS: GlossaryTerm[] = [
  {
    id: 'ct-scan',
    term: 'CT Scan',
    category: 'imaging-types',
    definition: 'Computed Tomography scan uses X-rays to create detailed cross-sectional images of the body.',
    plainLanguage: 'A CT scan is like taking many X-ray pictures from different angles and combining them to see inside your body in detail.',
    examples: ['Brain CT', 'Chest CT', 'Abdominal CT'],
    relatedTerms: ['x-ray', 'contrast', 'radiation'],
  },
  {
    id: 'mri',
    term: 'MRI',
    category: 'imaging-types',
    definition: 'Magnetic Resonance Imaging uses strong magnetic fields and radio waves to create detailed images of internal structures.',
    plainLanguage: 'An MRI uses powerful magnets instead of radiation to take very detailed pictures of your organs and tissues.',
    examples: ['Brain MRI', 'Spine MRI', 'Knee MRI'],
    relatedTerms: ['magnetic-field', 'contrast', 'gadolinium'],
  },
  {
    id: 'ultrasound',
    term: 'Ultrasound',
    category: 'imaging-types',
    definition: 'Uses high-frequency sound waves to create real-time images of internal structures.',
    plainLanguage: 'Ultrasound uses sound waves (like bats use) to create moving pictures of what\'s inside your body.',
    examples: ['Pregnancy ultrasound', 'Heart ultrasound', 'Abdominal ultrasound'],
    relatedTerms: ['doppler', 'transducer', 'gel'],
  },
  {
    id: 'contrast',
    term: 'Contrast Agent',
    category: 'procedures',
    definition: 'A substance used to enhance the visibility of internal structures in medical imaging.',
    plainLanguage: 'Contrast is like a special dye that helps doctors see certain parts of your body more clearly in the pictures.',
    examples: ['Iodine contrast', 'Gadolinium', 'Barium'],
    relatedTerms: ['injection', 'allergic-reaction', 'kidney-function'],
  },
  {
    id: 'radiation',
    term: 'Radiation',
    category: 'safety',
    definition: 'Energy waves or particles used in certain types of medical imaging.',
    plainLanguage: 'Radiation is a type of energy used to take pictures inside your body. The amount used is very small and generally safe.',
    examples: ['X-ray radiation', 'CT radiation'],
    relatedTerms: ['dose', 'safety', 'pregnancy'],
  },
];

const CATEGORIES: GlossaryCategory[] = [
  {
    id: 'imaging-types',
    name: 'Imaging Types',
    description: 'Different types of medical imaging procedures',
    termCount: 3,
  },
  {
    id: 'procedures',
    name: 'Procedures',
    description: 'Medical procedures and techniques',
    termCount: 1,
  },
  {
    id: 'safety',
    name: 'Safety',
    description: 'Safety considerations and information',
    termCount: 1,
  },
];

/**
 * ImagingGlossary component provides multilingual medical imaging terminology
 * with patient-friendly explanations and audio support
 */
export const ImagingGlossary: React.FC<ImagingGlossaryProps> = ({
  searchTerm = '',
  category,
  language,
  onTermSelect,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  
  // Component state
  const [terms, setTerms] = useState<GlossaryTerm[]>(SAMPLE_TERMS);
  const [categories, setCategories] = useState<GlossaryCategory[]>(CATEGORIES);
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(category || 'all');
  const [searchQuery, setSearchQuery] = useState(searchTerm);
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  /**
   * Filter terms based on search and category
   */
  const filteredTerms = useMemo(() => {
    let filtered = terms;

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(term => term.category === activeCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(term => 
        term.term.toLowerCase().includes(query) ||
        term.definition.toLowerCase().includes(query) ||
        term.plainLanguage.toLowerCase().includes(query) ||
        term.examples?.some(example => example.toLowerCase().includes(query))
      );
    }

    return filtered.sort((a, b) => a.term.localeCompare(b.term));
  }, [terms, activeCategory, searchQuery]);

  /**
   * Load terms from API based on current language
   */
  const loadTerms = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/glossary/imaging-terms`, {
        headers: {
          'Accept-Language': language || i18n.language,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTerms(data.terms || SAMPLE_TERMS);
        setCategories(data.categories || CATEGORIES);
      }
    } catch (error) {
      console.warn('Failed to load glossary terms, using defaults:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle term selection
   */
  const handleTermSelect = (term: GlossaryTerm) => {
    setSelectedTerm(term);
    onTermSelect?.(term);
  };

  /**
   * Play audio pronunciation
   */
  const playAudio = async (term: GlossaryTerm) => {
    if (!term.audioUrl) {
      // Generate audio using speech synthesis if no URL available
      const utterance = new SpeechSynthesisUtterance(term.term);
      utterance.lang = language || i18n.language;
      utterance.rate = 0.8;
      
      setPlayingAudio(term.id);
      utterance.onend = () => setPlayingAudio(null);
      utterance.onerror = () => setPlayingAudio(null);
      
      speechSynthesis.speak(utterance);
      return;
    }

    try {
      setPlayingAudio(term.id);
      const audio = new Audio(term.audioUrl);
      audio.onended = () => setPlayingAudio(null);
      audio.onerror = () => setPlayingAudio(null);
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      setPlayingAudio(null);
    }
  };

  // Load terms when language changes
  useEffect(() => {
    loadTerms();
  }, [language, i18n.language]);

  // Update search query when prop changes
  useEffect(() => {
    setSearchQuery(searchTerm);
  }, [searchTerm]);

  return (
    <div className={`imaging-glossary ${className}`}>
      {/* Header */}
      <div className="glossary-header">
        <h2>{t('glossary.title')}</h2>
        <p>{t('glossary.description')}</p>
      </div>

      {/* Search and Filters */}
      <div className="glossary-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder={t('glossary.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button className="search-button">🔍</button>
        </div>

        <div className="category-filters">
          <button
            className={`category-button ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            {t('glossary.all_categories')}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`category-button ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {t(`glossary.category_${cat.id}`, cat.name)} ({cat.termCount})
            </button>
          ))}
        </div>
      </div>

      <div className="glossary-content">
        {/* Terms List */}
        <div className="terms-list">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>{t('glossary.loading')}</p>
            </div>
          ) : filteredTerms.length === 0 ? (
            <div className="empty-state">
              <p>{t('glossary.no_terms_found')}</p>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  {t('glossary.clear_search')}
                </button>
              )}
            </div>
          ) : (
            filteredTerms.map(term => (
              <div
                key={term.id}
                className={`term-item ${selectedTerm?.id === term.id ? 'selected' : ''}`}
                onClick={() => handleTermSelect(term)}
              >
                <div className="term-header">
                  <h3 className="term-name">{term.term}</h3>
                  <button
                    className="audio-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playAudio(term);
                    }}
                    disabled={playingAudio === term.id}
                  >
                    {playingAudio === term.id ? '⏸️' : '🔊'}
                  </button>
                </div>
                
                <div className="term-preview">
                  <p className="plain-language">{term.plainLanguage}</p>
                </div>

                {term.examples && term.examples.length > 0 && (
                  <div className="term-examples">
                    <strong>{t('glossary.examples')}:</strong> {term.examples.join(', ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Term Details */}
        {selectedTerm && (
          <div className="term-details">
            <div className="details-header">
              <h2>{selectedTerm.term}</h2>
              <button
                className="close-details"
                onClick={() => setSelectedTerm(null)}
              >
                ✕
              </button>
            </div>

            <div className="details-content">
              <div className="definition-section">
                <h3>{t('glossary.medical_definition')}</h3>
                <p>{selectedTerm.definition}</p>
              </div>

              <div className="plain-language-section">
                <h3>{t('glossary.simple_explanation')}</h3>
                <p>{selectedTerm.plainLanguage}</p>
              </div>

              {selectedTerm.examples && selectedTerm.examples.length > 0 && (
                <div className="examples-section">
                  <h3>{t('glossary.examples')}</h3>
                  <ul>
                    {selectedTerm.examples.map((example, index) => (
                      <li key={index}>{example}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedTerm.relatedTerms && selectedTerm.relatedTerms.length > 0 && (
                <div className="related-terms-section">
                  <h3>{t('glossary.related_terms')}</h3>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImagingGlossary;