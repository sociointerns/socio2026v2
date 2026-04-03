/**
 * Test utilities for Recommended Events feature
 * Use these in browser console to test the recommendation algorithm
 */

import { generateRecommendations, shouldShowRecommendations } from './recommendations';

// Test data examples
export const mockUserPreferences = {
  department: "Computer Science", 
  campus: "Central Campus (Main)",
  email: "test@christuniversity.in"
};

export const mockEvents = [
  {
    event_id: "test-1",
    title: "AI Workshop", 
    organizing_dept: "Computer Science",
    category: "Academic",
    created_at: new Date().toISOString(),
    event_date: "2026-04-10",
    campus_hosted_at: "Central Campus (Main)",
    total_participants: 75,
    claims_applicable: true
  },
  {
    event_id: "test-2", 
    title: "Music Festival",
    organizing_dept: "Music Department",
    category: "Cultural", 
    created_at: new Date().toISOString(),
    event_date: "2026-04-12",
    campus_hosted_at: "Central Campus (Main)", 
    total_participants: 150
  }
];

/**
 * Test function to verify recommendations work
 * Run in browser console: testRecommendations()
 */
export async function testRecommendations() {
  console.log("🧪 Testing Recommendation System...\n");
  
  // Test 1: Should show recommendations
  console.log("1. Testing shouldShowRecommendations()");
  console.log("✅ Valid user:", shouldShowRecommendations(mockUserPreferences));
  console.log("❌ No department:", shouldShowRecommendations({...mockUserPreferences, department: null}));
  console.log("❌ No email:", shouldShowRecommendations({...mockUserPreferences, email: ""}));
  
  // Test 2: Generate recommendations
  console.log("\n2. Testing generateRecommendations()");
  try {
    const recommendations = await generateRecommendations(
      mockEvents as any[],
      mockUserPreferences,
      "Central Campus (Main)",
      3
    );
    console.log("✅ Generated recommendations:", recommendations.length);
    recommendations.forEach((event, i) => {
      console.log(`   ${i + 1}. ${event.title} (${event.organizing_dept})`);
    });
  } catch (error) {
    console.error("❌ Error generating recommendations:", error);
  }
  
  console.log("\n🎉 Test complete!");
}

// Helper to check current user data
export function debugCurrentUser() {
  // Note: This would need to be called from browser console on actual page
  console.log("Current user data needed for recommendations:");
  console.log("- userData.email:", "Check in AuthContext");
  console.log("- userData.department:", "Check in AuthContext"); 
  console.log("- userData.campus:", "Check in AuthContext");
}