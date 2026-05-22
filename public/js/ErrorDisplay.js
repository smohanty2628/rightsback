// public/js/ErrorDisplay.js
// Rights Back App - Enhanced Error Message Display
// Replaces generic "Unable to determine applicable regime" with specific, actionable guidance

/**
 * Display specific error messages with missing field details
 * This is the main function called when submission fails validation
 */
function showErrorMessage(validationResult) {
  const errorContainer = document.getElementById('error-display');
  
  if (!validationResult.valid) {
    errorContainer.innerHTML = buildErrorHTML(validationResult);
    errorContainer.style.display = 'block';
    
    // Scroll to error message
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight missing fields in the form
    highlightMissingFields(validationResult.errors);
  } else {
    errorContainer.style.display = 'none';
  }
}

/**
 * Build the error message HTML with specific missing fields
 */
function buildErrorHTML(validation) {
  const errorFields = validation.errors.map(e => e.message);
  
  return `
    <div class="error-message-box">
      <div class="error-header">
        <span class="error-icon">⚠️</span>
        <h3>Missing Required Information</h3>
      </div>
      
      <div class="error-content">
        <p class="error-intro">
          To calculate your termination rights, we need the following information:
        </p>
        
        <ul class="missing-fields-list">
          ${errorFields.map(field => `
            <li><span class="bullet">•</span> ${field}</li>
          `).join('')}
        </ul>
        
        <p class="error-guidance">
          Please scroll up and complete these fields, then submit again.
        </p>
        
        <button onclick="scrollToFirstError()" class="fix-errors-btn">
          ↑ Go to First Missing Field
        </button>
      </div>
    </div>
  `;
}

/**
 * Highlight missing fields in the form with red borders
 */
function highlightMissingFields(errors) {
  // First, remove all existing error highlights
  document.querySelectorAll('.field-error').forEach(el => {
    el.classList.remove('field-error');
  });
  
  // Add error highlights to missing fields
  errors.forEach(error => {
    const field = document.getElementById(error.field) || 
                  document.querySelector(`[name="${error.field}"]`);
    
    if (field) {
      field.classList.add('field-error');
      
      // Add error text below the field
      const existingError = field.parentElement.querySelector('.field-error-text');
      if (existingError) {
        existingError.remove();
      }
      
      const errorText = document.createElement('span');
      errorText.className = 'field-error-text';
      errorText.textContent = error.message;
      field.parentElement.appendChild(errorText);
    }
  });
}

/**
 * Scroll to the first error field
 */
function scrollToFirstError() {
  const firstError = document.querySelector('.field-error');
  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstError.focus();
  }
}

/**
 * Validate form before submission
 * Returns validation object with specific errors
 */
function validateForm() {
  const errors = [];
  const warnings = [];
  
  // Get form data
  const formData = {
    songTitle: document.getElementById('songTitle')?.value,
    releaseDate: document.getElementById('releaseDate')?.value,
    email: document.getElementById('email')?.value,
    phone: document.getElementById('phone')?.value,
    personallySignedDeal: document.querySelector('input[name="personallySignedDeal"]:checked')?.value,
    dealIncludedRights: document.querySelector('input[name="dealIncludedRights"]:checked')?.value,
    workForHire: document.querySelector('input[name="workForHire"]:checked')?.value,
    publishingDealDate: document.getElementById('publishingDealDate')?.value,
    copyrightDate: document.getElementById('copyrightDate')?.value,
    uscoNumber: document.getElementById('uscoNumber')?.value
  };
  
  // ===== BASIC REQUIRED FIELDS =====
  
  if (!formData.songTitle?.trim()) {
    errors.push({
      field: 'songTitle',
      message: 'Song title is required',
      severity: 'error'
    });
  }
  
  if (!formData.releaseDate) {
    errors.push({
      field: 'releaseDate',
      message: 'Release date is required to determine which copyright section applies',
      severity: 'error'
    });
  }
  
  if (!formData.email?.trim()) {
    errors.push({
      field: 'email',
      message: 'Email address is required',
      severity: 'error'
    });
  } else if (!isValidEmail(formData.email)) {
    errors.push({
      field: 'email',
      message: 'Please enter a valid email address',
      severity: 'error'
    });
  }
  
  // ===== SECTION-SPECIFIC VALIDATION =====
  
  if (formData.releaseDate) {
    const releaseYear = new Date(formData.releaseDate).getFullYear();
    
    if (releaseYear >= 1978) {
      // ===== SECTION 203 (POST-1978) REQUIREMENTS =====
      
      if (!formData.personallySignedDeal || formData.personallySignedDeal === 'unsure') {
        errors.push({
          field: 'personallySignedDeal',
          message: 'Please indicate if you personally signed the original publishing deal',
          severity: 'error'
        });
      }
      
      if (!formData.dealIncludedRights || formData.dealIncludedRights === 'unsure') {
        errors.push({
          field: 'dealIncludedRights',
          message: 'Please indicate if the deal included publishing/distribution rights',
          severity: 'error'
        });
      }
      
      if (!formData.workForHire || formData.workForHire === 'unsure') {
        errors.push({
          field: 'workForHire',
          message: 'Please indicate if this was a work-for-hire agreement',
          severity: 'error'
        });
      }
      
      // Publishing deal date - critical for calculation
      if (formData.personallySignedDeal === 'yes' && !formData.publishingDealDate) {
        errors.push({
          field: 'publishingDealDate',
          message: 'Date you signed the publishing deal is required to calculate your termination window',
          severity: 'error'
        });
      }
      
    } else {
      // ===== SECTION 304 (PRE-1978) REQUIREMENTS =====
      
      if (!formData.copyrightDate) {
        errors.push({
          field: 'copyrightDate',
          message: 'Copyright registration date is required for pre-1978 works',
          severity: 'error'
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    errorCount: errors.length,
    warningCount: warnings.length
  };
}

/**
 * Email validation helper
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get user-friendly summary of what's missing
 */
function getMissingSummary(validation) {
  if (validation.valid) {
    return 'All required fields are complete.';
  }
  
  const count = validation.errorCount;
  const plural = count === 1 ? 'field' : 'fields';
  return `${count} required ${plural} missing`;
}

// Export functions for use in main form
window.showErrorMessage = showErrorMessage;
window.validateForm = validateForm;
window.scrollToFirstError = scrollToFirstError;

