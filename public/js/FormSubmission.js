// public/js/FormSubmission.js
// Rights Back App - Enhanced Form Submission with Validation
// This file replaces the current form submission logic to include validation

/**
 * Handle form submission with validation
 * Call this when user clicks "Check My Rights"
 */
async function handleFormSubmit(event) {
  event.preventDefault();
  
  // Step 1: Validate the form
  const validation = validateForm();
  
  // Step 2: Show errors if validation fails
  if (!validation.valid) {
    showErrorMessage(validation);
    
    // Log for debugging
    console.log('Form validation failed:', {
      errorCount: validation.errorCount,
      errors: validation.errors.map(e => e.message)
    });
    
    return false; // Stop submission
  }
  
  // Step 3: Clear any previous errors
  document.getElementById('error-display').style.display = 'none';
  
  // Step 4: Show loading state
  showLoadingState();
  
  // Step 5: Collect form data
  const formData = collectFormData();
  
  // Step 6: Submit to server
  try {
    const response = await fetch('/api/calculate-rights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Step 7: Display results
    displayResults(result);
    
  } catch (error) {
    console.error('Submission error:', error);
    showSubmissionError(error.message);
  } finally {
    hideLoadingState();
  }
}

/**
 * Collect all form data
 */
function collectFormData() {
  return {
    // Basic info
    songTitle: document.getElementById('songTitle')?.value || '',
    releaseDate: document.getElementById('releaseDate')?.value || '',
    
    // Contact info
    email: document.getElementById('email')?.value || '',
    phone: document.getElementById('phone')?.value || '',
    
    // Legal questions
    personallySignedDeal: document.querySelector('input[name="personallySignedDeal"]:checked')?.value || '',
    dealIncludedRights: document.querySelector('input[name="dealIncludedRights"]:checked')?.value || '',
    workForHire: document.querySelector('input[name="workForHire"]:checked')?.value || '',
    
    // Dates
    publishingDealDate: document.getElementById('publishingDealDate')?.value || '',
    copyrightDate: document.getElementById('copyrightDate')?.value || '',
    
    // Optional
    uscoNumber: document.getElementById('uscoNumber')?.value || '',
    
    // Metadata
    submittedAt: new Date().toISOString()
  };
}

/**
 * Display results based on calculation
 */
function displayResults(result) {
  // Check if result indicates insufficient data (server-side check)
  if (result.status === 'insufficient_data') {
    showInsufficientDataError(result);
    return;
  }
  
  // Navigate to results page or display results inline
  if (typeof showResultsPage === 'function') {
    showResultsPage(result);
  } else {
    // Fallback: redirect to results page with data in sessionStorage
    sessionStorage.setItem('terminationResults', JSON.stringify(result));
    window.location.href = '/results.html';
  }
}

/**
 * Show error when server returns insufficient data
 */
function showInsufficientDataError(result) {
  const errorContainer = document.getElementById('error-display');
  
  errorContainer.innerHTML = `
    <div class="error-message-box">
      <div class="error-header">
        <span class="error-icon">⚠️</span>
        <h3>Unable to Calculate Termination Rights</h3>
      </div>
      
      <div class="error-content">
        <p class="error-intro">
          ${result.message || 'We need additional information to complete the analysis.'}
        </p>
        
        ${result.missing_fields && result.missing_fields.length > 0 ? `
          <ul class="missing-fields-list">
            ${result.missing_fields.map(field => `
              <li><span class="bullet">•</span> ${field}</li>
            `).join('')}
          </ul>
        ` : ''}
        
        <p class="error-guidance">
          ${result.guidance || 'Please complete the required fields above and try again.'}
        </p>
        
        <button onclick="scrollToTop()" class="fix-errors-btn">
          ↑ Go Back to Form
        </button>
      </div>
    </div>
  `;
  
  errorContainer.style.display = 'block';
  errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Show generic submission error
 */
function showSubmissionError(errorMessage) {
  const errorContainer = document.getElementById('error-display');
  
  errorContainer.innerHTML = `
    <div class="error-message-box">
      <div class="error-header">
        <span class="error-icon">❌</span>
        <h3>Submission Error</h3>
      </div>
      
      <div class="error-content">
        <p class="error-intro">
          There was a problem submitting your form. Please try again.
        </p>
        
        <p class="error-guidance">
          Error details: ${errorMessage}
        </p>
        
        <button onclick="location.reload()" class="fix-errors-btn">
          Try Again
        </button>
      </div>
    </div>
  `;
  
  errorContainer.style.display = 'block';
}

/**
 * Show loading state
 */
function showLoadingState() {
  const submitButton = document.getElementById('submit-button');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Calculating...';
    submitButton.classList.add('loading');
  }
  
  // Show loading spinner if it exists
  const loader = document.getElementById('loading-spinner');
  if (loader) {
    loader.style.display = 'block';
  }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const submitButton = document.getElementById('submit-button');
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = 'Check My Rights';
    submitButton.classList.remove('loading');
  }
  
  // Hide loading spinner
  const loader = document.getElementById('loading-spinner');
  if (loader) {
    loader.style.display = 'none';
  }
}

/**
 * Scroll to top of page
 */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Export for use in HTML
window.handleFormSubmit = handleFormSubmit;
window.collectFormData = collectFormData;