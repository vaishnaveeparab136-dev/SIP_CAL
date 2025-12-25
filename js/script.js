document.addEventListener('DOMContentLoaded', function() {
  // Initialize chart
  const ctx = document.getElementById('growthChart').getContext('2d');
  let growthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Investment Growth',
        data: [],
        backgroundColor: 'rgba(67, 97, 238, 0.2)',
        borderColor: 'rgba(67, 97, 238, 1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return '₹' + context.parsed.y.toLocaleString('en-IN');
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '₹' + value.toLocaleString('en-IN');
            }
          }
        }
      }
    }
  });

  // Hide results section initially
  document.getElementById('results').style.display = 'none';

  // Form submission
  document.getElementById('sipForm').addEventListener('submit', function(e) {
    e.preventDefault();
    calculateSIP(growthChart);
  });

  // Toggle between growth rate and growth amount
  const growthRateInput = document.getElementById('growthRate');
  const growthRateAmountInput = document.getElementById('growthRateAmount');
  
  [growthRateInput, growthRateAmountInput].forEach(input => {
    input.addEventListener('focus', function() {
      if (this === growthRateInput) {
        growthRateAmountInput.value = '';
      } else {
        growthRateInput.value = '';
      }
    });
  });
});

function calculateSIP(chart) {
  // Hide results section initially
  document.getElementById('results').style.display = 'none';

  // Get and validate input values
  const sipAmount = parseFloat(document.getElementById('sipAmount').value) || 0;
  const sipDuration = parseInt(document.getElementById('sipDuration').value) || 0;
  let growthRate = parseFloat(document.getElementById('growthRate').value) || 0;
  let growthRateAmount = parseFloat(document.getElementById('growthRateAmount').value) || 0;
  const growthDuration = parseInt(document.getElementById('growthDuration').value) || 0;
  const returnRate = parseFloat(document.getElementById('returnRate').value) || 0;

  // Validate inputs
  if (sipAmount <= 0 || sipDuration <= 0 || returnRate <= 0) {
    showAlert('Please enter valid values for SIP Amount, Duration, and Return Rate', 'danger');
    return;
  }

  // Prepare inputs
  growthRate = growthRate / 100; // from % to fraction
  const monthlyReturnRate = returnRate / 100 / 12;
  // We will NOT pre-multiply annualReturnFactor for next period—see below

  // Determine growth type
  const useAmountGrowth = growthRateAmount > 0;
  const yearlyGrowthAmount = useAmountGrowth ? growthRateAmount : 0;
  const yearlyGrowthFactor = !useAmountGrowth ? (1 + growthRate) : 1;

  // Initialize variables
  let totalInvestment = 0;
  let corpusValue = 0;
  let yearlyData = [];
  let yearlyLabels = [];
  let yearlyBreakdown = [];
  let corpusArr = [0]; // corpusArr[i]=corpus at end of year i

  // -- CORRECTED CALCULATION: FOLLOW EXCEL OBSERVED LOGIC
  // 1. For each year:
  //    - Find that year's applicable SIP amount (via growth)
  //    - Find FV at end of SIP-duration for all SIPs paid in that year (12 months)
  //    - Add prior corpus, compounded for one year
  //    - Continue
  
  for (let year = 1; year <= sipDuration; year++) {
    // This year's SIP amount per month
    let currentSIP;
    if (year <= growthDuration) {
      currentSIP = useAmountGrowth 
        ? sipAmount + (yearlyGrowthAmount * (year - 1))
        : sipAmount * Math.pow(yearlyGrowthFactor, year - 1);
    } else {
      currentSIP = useAmountGrowth 
        ? sipAmount + (yearlyGrowthAmount * growthDuration)
        : sipAmount * Math.pow(yearlyGrowthFactor, growthDuration);
    }

    // Calculate corpus grow for ~previous~ corpus by one year
    let priorCorpus = corpusArr[year - 1]; // corpus at end of (year-1)
    let compoundedPrior = priorCorpus * Math.pow(1 + monthlyReturnRate, 12);

    // FV of all new SIPs in this year at EOY
    // Each monthly SIP grows for (N - m) months; N = 12 (for within the same year)
    // This is the usual FV formula for an ordinary annuity (SIP), compounded monthly:
    // FV = P * [((1+r)^(n) - 1)/r] * (1 + r)
    // For Indian SIP calculators, it's common to assume payment at beginning of month, so *(1+r) factor; 
    // but in your Excel, the FV handling matches the payment at end of month (no *(1+r) at end).
    // Your excel's SIP FV for a year:
    // FV = SIP * [((1 + r) ^ n - 1)/r]
    // For the "annual" block, total FV for 12 payments
    const n = 12;
    const r = monthlyReturnRate;
    let yearFV = 0;
    if (r === 0) {
      yearFV = currentSIP * n;
    } else {
      yearFV = currentSIP * ((Math.pow(1 + r, n) - 1) / r);
    }
    
    // Add to corpus
    corpusValue = compoundedPrior + yearFV;
    corpusArr[year] = corpusValue; // for next cycle

    // Update total investment
    totalInvestment += currentSIP * 12;

    yearlyData.push(corpusValue);
    yearlyLabels.push(`Year ${year}`);

    // Prepare breakdown data
    let growthFactor = '-';
    if (year <= growthDuration) {
      growthFactor = useAmountGrowth ? 
        '₹' + yearlyGrowthAmount.toFixed(2) : 
        (growthRate * 100).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%';
    }

    yearlyBreakdown.push({
      year: year,
      monthlySIPAmount: currentSIP,
      growthRate: growthFactor,
      rateOfReturn: returnRate.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
      corpusValue: corpusValue
    });
  }

  // Update UI
  document.getElementById('totalInvestment').textContent = '₹' + Math.round(totalInvestment).toLocaleString('en-IN');
  document.getElementById('futureValue').textContent = '₹' + Math.round(corpusValue).toLocaleString('en-IN');

  // Update chart
  chart.data.labels = yearlyLabels;
  chart.data.datasets[0].data = yearlyData;
  chart.update();

  // Update yearly breakdown table
  updateYearlyTable(yearlyBreakdown);

  // Show results
  document.getElementById('results').style.display = 'block';
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}

function updateYearlyTable(data) {
  const tableBody = document.querySelector('#yearlyTable tbody');
  tableBody.innerHTML = '';

  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.year}</td>
      <td>₹${row.monthlySIPAmount.toFixed(2)}</td>
      <td>${row.growthRate}</td>
      <td>${row.rateOfReturn}%</td>
      <td>₹${Math.round(row.corpusValue).toLocaleString('en-IN')}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function showAlert(message, type) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.role = 'alert';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  const form = document.getElementById('sipForm');
  form.prepend(alertDiv);
  setTimeout(() => {
    if (alertDiv) alertDiv.remove();
  }, 15000);
}
