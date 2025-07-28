const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('Specialties Configuration', () => {
  let specialtiesConfig;

  beforeAll(() => {
    const specialtiesPath = path.join(__dirname, '..', 'ai-tuning', 'specialties.yaml');
    const fileContents = fs.readFileSync(specialtiesPath, 'utf8');
    specialtiesConfig = yaml.load(fileContents);
  });

  test('should load specialties.yaml file successfully', () => {
    expect(specialtiesConfig).toBeDefined();
    expect(specialtiesConfig.version).toBeDefined();
    expect(specialtiesConfig.specialties).toBeDefined();
  });

  test('should have correct version and description', () => {
    expect(specialtiesConfig.version).toBe('1.0');
    expect(specialtiesConfig.description).toContain('Medical specialties and areas of expertise');
  });

  test('should contain all required medical specialties', () => {
    const expectedSpecialties = [
      'primary_care',
      'radiology', 
      'cardiology',
      'pediatrics',
      'oncology',
      'psychiatry',
      'endocrinology',
      'orthopedics',
      'neurology',
      'gastroenterology',
      'pulmonology',
      'dermatology',
      'obgyn'
    ];

    expectedSpecialties.forEach(specialty => {
      expect(specialtiesConfig.specialties[specialty]).toBeDefined();
      expect(specialtiesConfig.specialties[specialty].name).toBeDefined();
      expect(specialtiesConfig.specialties[specialty].description).toBeDefined();
      expect(specialtiesConfig.specialties[specialty].focus_areas).toBeDefined();
      expect(Array.isArray(specialtiesConfig.specialties[specialty].focus_areas)).toBe(true);
    });
  });

  test('should contain technical areas', () => {
    expect(specialtiesConfig.technical_areas).toBeDefined();
    
    const expectedTechnicalAreas = [
      'frontend_development',
      'backend_development',
      'devops',
      'machine_learning',
      'data_science',
      'interoperability',
      'security'
    ];

    expectedTechnicalAreas.forEach(area => {
      expect(specialtiesConfig.technical_areas[area]).toBeDefined();
      expect(specialtiesConfig.technical_areas[area].name).toBeDefined();
      expect(specialtiesConfig.technical_areas[area].description).toBeDefined();
      expect(specialtiesConfig.technical_areas[area].focus_areas).toBeDefined();
    });
  });

  test('should have proper metadata structure', () => {
    expect(specialtiesConfig.metadata).toBeDefined();
    expect(specialtiesConfig.metadata.last_updated).toBeDefined();
    expect(specialtiesConfig.metadata.version_history).toBeDefined();
    expect(Array.isArray(specialtiesConfig.metadata.version_history)).toBe(true);
    expect(specialtiesConfig.metadata.maintainers).toBeDefined();
    expect(specialtiesConfig.metadata.contact).toBeDefined();
  });

  test('should have usage guidelines', () => {
    expect(specialtiesConfig.usage_guidelines).toBeDefined();
    expect(specialtiesConfig.usage_guidelines.contributor_selection).toBeDefined();
    expect(specialtiesConfig.usage_guidelines.review_assignment).toBeDefined();
    expect(specialtiesConfig.usage_guidelines.future_extensions).toBeDefined();
  });

  test('each specialty should have required fields', () => {
    Object.values(specialtiesConfig.specialties).forEach(specialty => {
      expect(specialty.name).toBeTruthy();
      expect(specialty.description).toBeTruthy();
      expect(specialty.focus_areas).toBeDefined();
      expect(Array.isArray(specialty.focus_areas)).toBe(true);
      expect(specialty.focus_areas.length).toBeGreaterThan(0);
    });
  });

  test('each technical area should have required fields', () => {
    Object.values(specialtiesConfig.technical_areas).forEach(area => {
      expect(area.name).toBeTruthy();
      expect(area.description).toBeTruthy();
      expect(area.focus_areas).toBeDefined();
      expect(Array.isArray(area.focus_areas)).toBe(true);
      expect(area.focus_areas.length).toBeGreaterThan(0);
    });
  });

  test('should have valid YAML structure', () => {
    // This test passes if the YAML loads without errors (checked in beforeAll)
    expect(typeof specialtiesConfig).toBe('object');
    expect(specialtiesConfig).not.toBeNull();
  });
});