import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from './storage';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface RestaurantInsights {
  performanceSummary: string;
  recommendations: string[];
  popularItemsAnalysis: string;
  customerSatisfaction: string;
  growthOpportunities: string[];
}

export async function generateRestaurantInsights(
  restaurantId: number,
  startDate: Date,
  endDate: Date
): Promise<RestaurantInsights> {
  try {
    // Fetch analytics data
    const [
      revenue,
      orderCount,
      avgOrderValue,
      popularItems,
      feedbackList,
      restaurant
    ] = await Promise.all([
      storage.getRestaurantRevenue(restaurantId, startDate, endDate),
      storage.getOrderCountByRestaurantId(restaurantId, startDate, endDate),
      storage.getAverageOrderValue(restaurantId, startDate, endDate),
      storage.getPopularMenuItems(restaurantId, 5),
      storage.getFeedbackByRestaurantId(restaurantId),
      storage.getRestaurant(restaurantId)
    ]);

    // Calculate additional metrics
    const dateRange = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyAvgRevenue = revenue / dateRange;
    const dailyAvgOrders = orderCount / dateRange;

    // Filter feedback within date range
    const relevantFeedback = feedbackList.filter(
      (fb: any) => fb.createdAt >= startDate && fb.createdAt <= endDate
    );
    
    const avgRating = relevantFeedback.length > 0
      ? relevantFeedback.reduce((sum: number, fb: any) => sum + fb.rating, 0) / relevantFeedback.length
      : 0;

    // Prepare data for AI analysis
    const analyticsData = {
      restaurantName: restaurant?.name || 'Restaurant',
      dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      totalRevenue: revenue,
      totalOrders: orderCount,
      averageOrderValue: avgOrderValue,
      dailyAverageRevenue: dailyAvgRevenue,
      dailyAverageOrders: dailyAvgOrders,
      popularItems: popularItems.map((item: any) => ({
        name: item.name,
        orderCount: item.count,
        price: item.price
      })),
      customerFeedback: {
        averageRating: avgRating,
        totalReviews: relevantFeedback.length,
        recentComments: relevantFeedback.slice(0, 5).map((fb: any) => ({
          rating: fb.rating,
          comment: fb.comment
        }))
      }
    };

    // Generate insights using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
    You are a restaurant business analyst. Analyze the following restaurant data and provide actionable insights:
    
    Restaurant: ${analyticsData.restaurantName}
    Period: ${analyticsData.dateRange}
    
    Performance Metrics:
    - Total Revenue: $${analyticsData.totalRevenue.toFixed(2)}
    - Total Orders: ${analyticsData.totalOrders}
    - Average Order Value: $${analyticsData.averageOrderValue.toFixed(2)}
    - Daily Average Revenue: $${analyticsData.dailyAverageRevenue.toFixed(2)}
    - Daily Average Orders: ${analyticsData.dailyAverageOrders.toFixed(2)}
    
    Top 5 Popular Items:
    ${analyticsData.popularItems.map((item: any, i: number) => 
      `${i + 1}. ${item.name} - ${item.orderCount} orders at $${item.price}`
    ).join('\n')}
    
    Customer Satisfaction:
    - Average Rating: ${analyticsData.customerFeedback.averageRating.toFixed(1)}/5
    - Total Reviews: ${analyticsData.customerFeedback.totalReviews}
    ${analyticsData.customerFeedback.recentComments.length > 0 ? 
      `\nRecent Feedback:\n${analyticsData.customerFeedback.recentComments.map((c: any) => 
        `- Rating: ${c.rating}/5 - "${c.comment || 'No comment'}"`
      ).join('\n')}` : ''}
    
    Please provide:
    1. A brief performance summary (2-3 sentences)
    2. 3-5 specific, actionable recommendations to improve the business
    3. Analysis of popular items and menu optimization suggestions
    4. Customer satisfaction insights
    5. 2-3 growth opportunities
    
    Format your response as JSON with the following structure:
    {
      "performanceSummary": "string",
      "recommendations": ["string", "string", ...],
      "popularItemsAnalysis": "string",
      "customerSatisfaction": "string",
      "growthOpportunities": ["string", "string", ...]
    }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    const insights = JSON.parse(jsonMatch[0]) as RestaurantInsights;
    
    return insights;
  } catch (error) {
    console.error('Error generating AI insights:', error);
    
    // Return fallback insights if AI fails
    return {
      performanceSummary: 'Unable to generate AI insights at this time. Please check your data and try again.',
      recommendations: [
        'Ensure consistent data collection for accurate insights',
        'Monitor daily performance metrics',
        'Collect more customer feedback'
      ],
      popularItemsAnalysis: 'Popular items data available but AI analysis unavailable.',
      customerSatisfaction: 'Customer feedback data available but AI analysis unavailable.',
      growthOpportunities: [
        'Implement regular performance reviews',
        'Focus on data-driven decision making'
      ]
    };
  }
}

export async function generateMenuOptimizationSuggestions(
  restaurantId: number,
  currentMenuItems: any[]
): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
    Analyze this restaurant menu and suggest optimizations:
    
    Current Menu (${currentMenuItems.length} items):
    ${currentMenuItems.map(item => 
      `- ${item.name} (${item.category}) - $${item.price} - ${item.isAvailable ? 'Available' : 'Unavailable'}`
    ).join('\n')}
    
    Provide 5 specific menu optimization suggestions considering:
    1. Category balance
    2. Price points
    3. Menu variety
    4. Potential missing items
    5. Seasonal considerations
    
    Return only a JSON array of strings: ["suggestion1", "suggestion2", ...]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    return JSON.parse(jsonMatch[0]) as string[];
  } catch (error) {
    console.error('Error generating menu suggestions:', error);
    return [
      'Review menu pricing strategy',
      'Consider adding seasonal items',
      'Ensure balanced category distribution',
      'Analyze item availability patterns',
      'Consider customer dietary preferences'
    ];
  }
}

export async function analyzeFeedbackSentiment(feedback: string): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative';
  keyPoints: string[];
  suggestedResponse?: string;
}> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
    Analyze the sentiment and key points of this customer feedback:
    
    "${feedback}"
    
    Provide:
    1. Overall sentiment (positive, neutral, or negative)
    2. 2-3 key points from the feedback
    3. A suggested professional response (if sentiment is negative)
    
    Return JSON:
    {
      "sentiment": "positive" | "neutral" | "negative",
      "keyPoints": ["point1", "point2"],
      "suggestedResponse": "response text" (only if negative)
    }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error analyzing feedback:', error);
    return {
      sentiment: 'neutral',
      keyPoints: ['Unable to analyze feedback at this time']
    };
  }
}