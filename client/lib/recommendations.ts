/**
 * Recommendation utilities for "Recommended for You" section
 * Provides personalized event suggestions based on user profile and activity
 */

import { FetchedEvent } from '../context/EventContext';
import { matchesSelectedCampus } from '../context/EventContext';
import { getUserRegistrations } from './api';

export interface UserPreferences {
  department: string | null;
  campus: string | null;
  email: string;
}

export interface RecommendationScore {
  event: FetchedEvent;
  score: number;
  reasons: string[];
}

/**
 * Normalize string for comparison (handles case and whitespace)
 */
function normalizeString(str: string | null): string {
  if (!str) return '';
  return str.trim().toLowerCase();
}

/**
 * Calculate recommendation score for an event based on user preferences
 */
function calculateEventScore(
  event: FetchedEvent, 
  userPreferences: UserPreferences,
  userCategories: string[]
): RecommendationScore {
  let score = 0;
  const reasons: string[] = [];

  // Base score for all events
  score += 1;

  // Department match (highest priority) - Weight: 3x
  if (event.organizing_dept && userPreferences.department) {
    const eventDept = normalizeString(event.organizing_dept);
    const userDept = normalizeString(userPreferences.department);
    
    if (eventDept === userDept) {
      score += 3;
      reasons.push(`Organized by your department (${event.organizing_dept})`);
    } else if (eventDept.includes(userDept) || userDept.includes(eventDept)) {
      score += 2;
      reasons.push(`Related to your department (${event.organizing_dept})`);
    }
  }

  // Category preference match (based on user's registered events) - Weight: 2x
  if (event.category && userCategories.length > 0) {
    const eventCategory = normalizeString(event.category);
    const matchingCategory = userCategories.find(cat => 
      normalizeString(cat) === eventCategory
    );
    
    if (matchingCategory) {
      score += 2;
      reasons.push(`Matches your interest in ${event.category} events`);
    }
  }

  // Recent event bonus (created within last 7 days) - Weight: 1x
  if (event.created_at) {
    const eventDate = new Date(event.created_at);
    const daysSinceCreated = (Date.now() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreated <= 7) {
      score += 1;
      reasons.push('Recently announced');
    }
  }

  // Popular event bonus (high participation) - Weight: 0.5x
  if (event.total_participants && event.total_participants >= 50) {
    score += 0.5;
    reasons.push(`Popular event (${event.total_participants} participants)`);
  }

  // Claims bonus - Weight: 0.5x
  if (event.claims_applicable) {
    score += 0.5;
    reasons.push('Offers academic claims');
  }

  return {
    event,
    score,
    reasons
  };
}

/**
 * Extract user's category preferences from their registration history
 */
function extractUserCategories(userRegistrations: any[]): string[] {
  const categories: string[] = [];
  
  for (const registration of userRegistrations) {
    if (registration.events && registration.events.category) {
      categories.push(registration.events.category);
    }
  }
  
  // Count frequencies and return most common categories
  const categoryCount = categories.reduce((acc, cat) => {
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(categoryCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3) // Top 3 categories
    .map(([cat]) => cat);
}

/**
 * Generate personalized event recommendations for a user
 */
export async function generateRecommendations(
  allEvents: FetchedEvent[],
  userPreferences: UserPreferences,
  selectedCampus: string,
  limit: number = 6
): Promise<FetchedEvent[]> {
  try {
    // Skip if no user or no department
    if (!userPreferences.email || !userPreferences.department) {
      return [];
    }

    // Normalize department for comparison
    const normalizedUserDept = normalizeString(userPreferences.department);
    if (!normalizedUserDept) {
      return [];
    }

    // Fetch user's registration history
    let userRegistrations: any[] = [];
    let registeredEventIds: string[] = [];
    
    try {
      userRegistrations = await getUserRegistrations(userPreferences.email);
      registeredEventIds = userRegistrations
        .map(reg => reg.events?.event_id || reg.event_id)
        .filter(Boolean);
    } catch (registrationError) {
      // If we can't get registrations, continue without exclusion
      console.warn('Could not fetch user registrations:', registrationError);
      registeredEventIds = [];
    }

    // Extract user's category preferences from history
    const userCategories = extractUserCategories(userRegistrations);

    // Filter events
    const eligibleEvents = allEvents.filter(event => {
      // Must have required fields
      if (!event.event_id || !event.title) {
        return false;
      }

      // Exclude events user is already registered for
      if (registeredEventIds.includes(event.event_id)) {
        return false;
      }

      // Only events matching selected campus
      try {
        if (!matchesSelectedCampus(event, selectedCampus)) {
          return false;
        }
      } catch (campusError) {
        // If campus matching fails, include the event
        console.warn('Campus matching failed for event:', event.event_id, campusError);
      }

      // Only future or current events (with graceful date handling)
      if (event.event_date) {
        try {
          const eventDate = new Date(event.event_date);
          const now = new Date();
          // Set time to end of day to include events happening today
          now.setHours(0, 0, 0, 0);
          if (eventDate < now) {
            return false;
          }
        } catch (dateError) {
          // If date parsing fails, include the event
          console.warn('Date parsing failed for event:', event.event_id, dateError);
        }
      }

      return true;
    });

    // If no eligible events, return empty array
    if (eligibleEvents.length === 0) {
      return [];
    }

    // Calculate scores for all eligible events
    const scoredEvents = eligibleEvents
      .map(event => {
        try {
          return calculateEventScore(event, userPreferences, userCategories);
        } catch (scoreError) {
          console.warn('Scoring failed for event:', event.event_id, scoreError);
          // Return a minimal score to include the event
          return {
            event,
            score: 1,
            reasons: []
          };
        }
      })
      .filter(Boolean); // Remove any null results

    // Sort by score (descending) and return top recommendations
    const recommendations = scoredEvents
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, limit)) // At least 1, but respect limit
      .map(scored => scored.event);

    return recommendations;

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return [];
  }
}

/**
 * Check if a user should see recommendations
 */
export function shouldShowRecommendations(userPreferences: UserPreferences): boolean {
  // Must have email (logged in)
  if (!userPreferences.email || typeof userPreferences.email !== 'string') {
    return false;
  }

  // Must have department information
  if (!userPreferences.department || typeof userPreferences.department !== 'string') {
    return false;
  }

  // Department must not be empty or just whitespace
  const normalizedDept = normalizeString(userPreferences.department);
  if (!normalizedDept || normalizedDept.length < 2) {
    return false;
  }

  // Must have valid email format (basic check)
  if (!userPreferences.email.includes('@') || userPreferences.email.length < 5) {
    return false;
  }

  return true;
}