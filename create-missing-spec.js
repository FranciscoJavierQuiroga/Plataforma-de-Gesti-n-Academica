// create-missing-specs.js
// Run with: node create-missing-specs.js

const fs = require('fs');
const path = require('path');

// Template for basic component spec
const componentTemplate = (componentName, componentPath) => `import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ${componentName} } from './${path.basename(componentPath, '.ts')}';

describe('${componentName}', () => {
  let component: ${componentName};
  let fixture: ComponentFixture<${componentName}>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ${componentName},
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(${componentName});
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
`;

// Template for service spec
const serviceTemplate = (serviceName, servicePath) => `import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ${serviceName} } from './${path.basename(servicePath, '.ts')}';

describe('${serviceName}', () => {
  let service: ${serviceName};

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [${serviceName}]
    });
    service = TestBed.inject(${serviceName});
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
`;

// Function to find all .ts files without corresponding .spec.ts
function findFilesWithoutSpecs(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (file !== 'node_modules' && file !== 'dist') {
        findFilesWithoutSpecs(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && 
               !file.endsWith('.spec.ts') && 
               !file.endsWith('.module.ts') &&
               !file.includes('main.ts') &&
               !file.includes('polyfills.ts')) {
      
      const specPath = filePath.replace('.ts', '.spec.ts');
      if (!fs.existsSync(specPath)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

// Function to extract component/service name from file
function extractClassName(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Try to find class name
  const classMatch = content.match(/export\s+class\s+(\w+)/);
  if (classMatch) {
    return classMatch[1];
  }
  
  // Fallback: use filename
  const fileName = path.basename(filePath, '.ts');
  return fileName.charAt(0).toUpperCase() + fileName.slice(1);
}

// Main execution
const srcPath = path.join(__dirname, 'src', 'app');
const filesWithoutSpecs = findFilesWithoutSpecs(srcPath);

console.log(`Found ${filesWithoutSpecs.length} files without spec files:`);

filesWithoutSpecs.forEach(filePath => {
  const className = extractClassName(filePath);
  const isService = filePath.includes('service');
  const specPath = filePath.replace('.ts', '.spec.ts');
  
  let content;
  if (isService) {
    content = serviceTemplate(className, filePath);
  } else {
    content = componentTemplate(className, filePath);
  }
  
  console.log(`Creating: ${specPath}`);
  fs.writeFileSync(specPath, content, 'utf8');
});

console.log('✓ All spec files created!');