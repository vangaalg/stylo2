# Cost & Profit Analysis - StyleGenie AI

## Current Pricing Structure

| Package | Price (₹) | Credits | Auto-Gen Photos | Manual Unlocks | Total Photos (Max) |
|---------|-----------|---------|-----------------|----------------|-------------------|
| Single Look | 99 | 4 | 2 | 2 | 4 |
| Trial Pack | 149 | 8 | 2 | 6 | 8 |
| Starter Pack | 999 | 54 | 2 | 52 | 54 |
| Pro Pack | 1,500 | 102 | 2 | 100 | 102 |

---

## Cost Breakdown Per Photo Generation

### API Costs (Estimated)

| Service | Fast Mode | Quality Mode | Notes |
|---------|-----------|-------------|-------|
| **Gemini 2.5 Flash Image** | ₹0.50 | - | Per image generation |
| **Gemini 3 Pro Image Preview** | - | ₹2.00 | Per image generation |
| **Gemini 2.0 Flash (Analysis)** | ₹0.10 | ₹0.10 | Face & cloth analysis (2 calls) |
| **Replicate Face Swap** | ₹0.50 | ₹0.50 | Per face swap |
| **Total Cost per Photo** | **₹1.10** | **₹2.60** | Fast vs Quality |

### Phone Authentication Costs

| Item | Cost | Type |
|------|------|------|
| **SMS OTP (per SMS)** | ₹0.30 | Variable |
| **Development (one-time)** | ₹30,000 | Fixed |
| **Monthly Maintenance** | ₹2,000 | Fixed |

### Other Costs

| Item | Cost | Type |
|------|------|------|
| **Razorpay Transaction Fee** | 2% of revenue | Variable |
| **Vercel Hosting** | ₹0 (Hobby) / ₹2,000+ (Pro) | Fixed (if scale) |
| **Supabase Storage** | ₹0 (Free tier) / ₹500+ | Variable (if scale) |

---

## Profit Analysis Per Package

### Assumptions:
- **Average Usage**: 70% Fast Mode, 30% Quality Mode
- **Average Cost per Credit**: (0.7 × ₹1.10) + (0.3 × ₹2.60) = **₹1.55 per credit**
- **Razorpay Fee**: 2% of revenue

### Single Look (₹99, 4 Credits)

| Item | Amount (₹) |
|------|-----------|
| **Revenue** | 99.00 |
| **API Costs** (4 × ₹1.55) | 6.20 |
| **Razorpay Fee** (2%) | 1.98 |
| **Total Costs** | 8.18 |
| **Gross Profit** | **90.82** |
| **Profit Margin** | **91.7%** |

### Trial Pack (₹149, 8 Credits)

| Item | Amount (₹) |
|------|-----------|
| **Revenue** | 149.00 |
| **API Costs** (8 × ₹1.55) | 12.40 |
| **Razorpay Fee** (2%) | 2.98 |
| **Total Costs** | 15.38 |
| **Gross Profit** | **133.62** |
| **Profit Margin** | **89.7%** |

### Starter Pack (₹999, 54 Credits)

| Item | Amount (₹) |
|------|-----------|
| **Revenue** | 999.00 |
| **API Costs** (54 × ₹1.55) | 83.70 |
| **Razorpay Fee** (2%) | 19.98 |
| **Total Costs** | 103.68 |
| **Gross Profit** | **895.32** |
| **Profit Margin** | **89.6%** |

### Pro Pack (₹1,500, 102 Credits)

| Item | Amount (₹) |
|------|-----------|
| **Revenue** | 1,500.00 |
| **API Costs** (102 × ₹1.55) | 158.10 |
| **Razorpay Fee** (2%) | 30.00 |
| **Total Costs** | 188.10 |
| **Gross Profit** | **1,311.90** |
| **Profit Margin** | **87.5%** |

---

## Break-Even Analysis (Including Phone Auth)

### Fixed Costs (One-Time)

| Item | Cost (₹) |
|------|----------|
| **Phone Auth Development** | 30,000 |
| **Total Fixed Costs** | **30,000** |

### Monthly Fixed Costs

| Item | Cost (₹) |
|------|----------|
| **Phone Auth Maintenance** | 2,000 |
| **Vercel (if Pro needed)** | 0 (assume Hobby) |
| **Total Monthly Fixed** | **2,000** |

### Break-Even Calculation

**Break-Even Units = (Fixed Costs + Monthly Costs) / Profit per Package**

| Package | Profit/Unit | Break-Even (Month 1) | Break-Even (Subsequent Months) |
|---------|-------------|---------------------|-------------------------------|
| **Single Look** | ₹90.82 | 352 units | 22 units/month |
| **Trial Pack** | ₹133.62 | 240 units | 15 units/month |
| **Starter Pack** | ₹895.32 | 36 units | 3 units/month |
| **Pro Pack** | ₹1,311.90 | 24 units | 2 units/month |

---

## Revenue Scenarios

### Scenario 1: Conservative (100 Users/Month)
- 50 × Single Look (₹99) = ₹4,950
- 30 × Trial Pack (₹149) = ₹4,470
- 15 × Starter Pack (₹999) = ₹14,985
- 5 × Pro Pack (₹1,500) = ₹7,500
- **Total Revenue**: ₹31,905
- **Total Costs**: ₹2,000 (fixed) + ₹1,240 (API) + ₹638 (Razorpay) = ₹3,878
- **Net Profit**: **₹28,027/month**

### Scenario 2: Moderate (500 Users/Month)
- 200 × Single Look = ₹19,800
- 150 × Trial Pack = ₹22,350
- 100 × Starter Pack = ₹99,900
- 50 × Pro Pack = ₹75,000
- **Total Revenue**: ₹217,050
- **Total Costs**: ₹2,000 (fixed) + ₹6,200 (API) + ₹4,341 (Razorpay) = ₹12,541
- **Net Profit**: **₹204,509/month**

### Scenario 3: Aggressive (1,000 Users/Month)
- 400 × Single Look = ₹39,600
- 300 × Trial Pack = ₹44,700
- 200 × Starter Pack = ₹199,800
- 100 × Pro Pack = ₹150,000
- **Total Revenue**: ₹434,100
- **Total Costs**: ₹2,000 (fixed) + ₹12,400 (API) + ₹8,682 (Razorpay) = ₹23,082
- **Net Profit**: **₹411,018/month**

---

## Key Insights

1. **High Profit Margins**: All packages have 87-92% profit margins
2. **Break-Even is Achievable**: Even with phone auth, break-even is 24-352 units depending on package mix
3. **Pro Pack is Most Efficient**: Lowest break-even point (24 units) and highest profit per unit
4. **Phone Auth ROI**: One-time ₹30,000 investment pays off quickly with high-margin packages
5. **Scalability**: Costs scale linearly with usage, maintaining high margins

---

## Recommendations

1. **Focus on Higher Packages**: Pro Pack has best ROI for break-even
2. **Phone Auth is Worth It**: Low monthly cost (₹2,000) vs high user value
3. **Monitor API Costs**: If Gemini/Replicate prices increase, adjust pricing
4. **Consider Bundles**: Offer discounts on Starter/Pro to increase average order value
5. **SMS Cost Optimization**: Negotiate bulk SMS rates (can reduce to ₹0.20/SMS)

---

*Note: All costs are estimates based on current market rates. Actual costs may vary.*

