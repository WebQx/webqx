/**
 * WebQX Module Discovery and Display System
 * Dynamically loads and displays all available modules from modules.json
 */

class WebQXModuleManager {
    constructor() {
        this.modules = {};
        this.categories = {};
        this.specialties = {};
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.init();
    }

    async init() {
        try {
            await this.loadModules();
            this.setupEventListeners();
            this.renderModules();
            this.renderCategories();
        } catch (error) {
            console.error('Failed to initialize WebQX Module Manager:', error);
            this.showError('Failed to load modules. Please refresh the page.');
        }
    }

    async loadModules() {
        try {
            const response = await fetch('./modules.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.modules = data.modules || {};
            this.categories = data.categories || {};
            this.specialties = data.specialties || {};
        } catch (error) {
            console.error('Error loading modules:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Category filter buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-filter')) {
                this.handleCategoryFilter(e.target.dataset.category);
            }
        });

        // Search functionality
        const searchInput = document.getElementById('module-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Module detail buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('module-detail-btn')) {
                this.showModuleDetails(e.target.dataset.moduleId);
            }
        });
    }

    handleCategoryFilter(category) {
        this.currentFilter = category;
        this.renderModules();
        this.updateFilterButtons();
    }

    handleSearch(term) {
        this.searchTerm = term.toLowerCase();
        this.renderModules();
    }

    updateFilterButtons() {
        document.querySelectorAll('.category-filter').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === this.currentFilter);
        });
    }

    renderCategories() {
        const container = document.getElementById('category-filters');
        if (!container) return;

        const allButton = `
            <button class="category-filter active" data-category="all">
                🌐 All Modules
            </button>
        `;

        const categoryButtons = Object.entries(this.categories).map(([key, category]) => `
            <button class="category-filter" data-category="${key}">
                ${category.icon} ${category.name}
            </button>
        `).join('');

        container.innerHTML = allButton + categoryButtons;
    }

    renderModules() {
        const container = document.getElementById('modules-container');
        if (!container) return;

        const filteredModules = this.getFilteredModules();
        
        if (filteredModules.length === 0) {
            container.innerHTML = `
                <div class="no-modules">
                    <h3>No modules found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredModules.map(([key, module]) => 
            this.renderModuleCard(key, module)
        ).join('');
    }

    getFilteredModules() {
        let filtered = Object.entries(this.modules);

        // Apply category filter
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(([_, module]) => module.category === this.currentFilter);
        }

        // Apply search filter
        if (this.searchTerm) {
            filtered = filtered.filter(([_, module]) => {
                const searchableText = `
                    ${module.name} 
                    ${module.description} 
                    ${module.features?.join(' ') || ''}
                    ${module.technologies?.join(' ') || ''}
                `.toLowerCase();
                return searchableText.includes(this.searchTerm);
            });
        }

        return filtered;
    }

    renderModuleCard(key, module) {
        const categoryInfo = this.categories[module.category] || { icon: '📦', name: 'Unknown' };
        const statusBadge = this.getStatusBadge(module.status);
        const techBadges = this.getTechBadges(module.technologies || []);
        const featuresList = this.getFeaturesList(module.features || []);
        const linkButtons = this.getLinkButtons(module.links || {});

        return `
            <div class="module-card" data-module="${key}" data-category="${module.category}">
                <div class="module-header">
                    <div class="module-title-section">
                        <h3 class="module-title">
                            ${categoryInfo.icon} ${module.name}
                        </h3>
                        ${statusBadge}
                    </div>
                    <div class="module-version">v${module.version}</div>
                </div>
                
                <div class="module-category">
                    <span class="category-badge">${categoryInfo.name}</span>
                </div>
                
                <p class="module-description">${module.description}</p>
                
                <div class="module-technologies">
                    <strong>Technologies:</strong>
                    <div class="tech-badges">${techBadges}</div>
                </div>
                
                <div class="module-features">
                    <strong>Key Features:</strong>
                    ${featuresList}
                </div>
                
                <div class="module-actions">
                    ${linkButtons}
                    <button class="module-detail-btn" data-module-id="${key}">
                        📋 View Details
                    </button>
                </div>
            </div>
        `;
    }

    getStatusBadge(status) {
        const statusConfig = {
            'active': { icon: '✅', class: 'status-active', text: 'Active' },
            'beta': { icon: '🧪', class: 'status-beta', text: 'Beta' },
            'development': { icon: '🚧', class: 'status-dev', text: 'In Development' },
            'deprecated': { icon: '⚠️', class: 'status-deprecated', text: 'Deprecated' }
        };
        
        const config = statusConfig[status] || statusConfig['active'];
        return `<span class="status-badge ${config.class}">${config.icon} ${config.text}</span>`;
    }

    getTechBadges(technologies) {
        return technologies.map(tech => 
            `<span class="tech-badge">${tech}</span>`
        ).join('');
    }

    getFeaturesList(features) {
        if (features.length === 0) return '<p>No features listed</p>';
        
        const displayFeatures = features.slice(0, 4);
        const remainingCount = features.length - displayFeatures.length;
        
        let html = '<ul class="features-list">';
        displayFeatures.forEach(feature => {
            html += `<li>${feature}</li>`;
        });
        
        if (remainingCount > 0) {
            html += `<li class="features-more">+${remainingCount} more features</li>`;
        }
        
        html += '</ul>';
        return html;
    }

    getLinkButtons(links) {
        const linkConfig = {
            'docs': { icon: '📚', text: 'Documentation' },
            'demo': { icon: '🚀', text: 'Demo' },
            'config': { icon: '⚙️', text: 'Configuration' },
            'api': { icon: '🔗', text: 'API Reference' }
        };

        return Object.entries(links).map(([type, url]) => {
            const config = linkConfig[type] || { icon: '🔗', text: 'Link' };
            return `
                <a href="${url}" class="module-link-btn" target="_blank" rel="noopener">
                    ${config.icon} ${config.text}
                </a>
            `;
        }).join('');
    }

    showModuleDetails(moduleId) {
        const module = this.modules[moduleId];
        if (!module) return;

        const modal = this.createModal(moduleId, module);
        document.body.appendChild(modal);
        
        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);
        
        // Close modal on backdrop click or escape key
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-close')) {
                this.closeModal(modal);
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
            }
        }, { once: true });
    }

    createModal(moduleId, module) {
        const categoryInfo = this.categories[module.category] || { icon: '📦', name: 'Unknown' };
        
        const modal = document.createElement('div');
        modal.className = 'module-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${categoryInfo.icon} ${module.name}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="module-full-info">
                        <div class="info-section">
                            <h3>📋 Overview</h3>
                            <p>${module.description}</p>
                        </div>
                        
                        <div class="info-section">
                            <h3>🔧 Technologies</h3>
                            <div class="tech-badges">${this.getTechBadges(module.technologies || [])}</div>
                        </div>
                        
                        <div class="info-section">
                            <h3>✨ Features</h3>
                            <ul class="full-features-list">
                                ${(module.features || []).map(feature => `<li>${feature}</li>`).join('')}
                            </ul>
                        </div>
                        
                        ${module.relatedSpecialties ? `
                            <div class="info-section">
                                <h3>🩺 Related Medical Specialties</h3>
                                <div class="specialty-badges">
                                    ${module.relatedSpecialties.map(specialty => 
                                        `<span class="specialty-badge">${this.specialties[specialty] || specialty}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${module.integrations ? `
                            <div class="info-section">
                                <h3>🔗 Integrations</h3>
                                <div class="integration-badges">
                                    ${module.integrations.map(integration => 
                                        `<span class="integration-badge">${integration}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="info-section">
                            <h3>📂 Path</h3>
                            <code class="module-path">${module.path}</code>
                        </div>
                        
                        <div class="info-section">
                            <h3>🔗 Resources</h3>
                            <div class="modal-links">
                                ${this.getLinkButtons(module.links || {})}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    }

    closeModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }

    showError(message) {
        const container = document.getElementById('modules-container') || document.body;
        container.innerHTML = `
            <div class="error-message">
                <h3>⚠️ Error</h3>
                <p>${message}</p>
            </div>
        `;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WebQXModuleManager();
});