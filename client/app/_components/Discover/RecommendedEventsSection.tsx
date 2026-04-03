"use client";

import React, { useMemo, useState, useEffect } from "react";
import { EventsSection } from "./EventsSection";
import { useAuth } from "../../../context/AuthContext";
import { FetchedEvent, toEventCard } from "../../../context/EventContext";
import { generateRecommendations, shouldShowRecommendations, UserPreferences } from "../../../lib/recommendations";

interface RecommendedEventsSectionProps {
  allEvents: FetchedEvent[];
  selectedCampus: string;
}

export const RecommendedEventsSection: React.FC<RecommendedEventsSectionProps> = ({
  allEvents,
  selectedCampus,
}) => {
  const { userData } = useAuth();
  const [recommendedEvents, setRecommendedEvents] = useState<FetchedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Check for mock data in parent element (for testing)
  const mockElement = typeof document !== 'undefined' ? 
    document.querySelector('[data-mock-auth="true"]') : null;
  const mockDepartment = mockElement?.getAttribute('data-user-department');
  
  // User preferences for recommendations (with mock data support)
  const userPreferences: UserPreferences = useMemo(() => ({
    department: mockDepartment || userData?.department || null,
    campus: userData?.campus || null,
    email: userData?.email || "mock@test.com",
  }), [userData, mockDepartment]);

  // Generate recommendations
  useEffect(() => {
    async function loadRecommendations() {
      // Early exits for edge cases
      if (!userData) {
        setRecommendedEvents([]);
        return;
      }

      if (!shouldShowRecommendations(userPreferences)) {
        setRecommendedEvents([]);
        return;
      }
      
      if (allEvents.length === 0) {
        setRecommendedEvents([]);
        return;
      }

      setIsLoading(true);
      try {
        const recommendations = await generateRecommendations(
          allEvents,
          userPreferences,
          selectedCampus,
          6 // Show up to 6 recommendations
        );
        setRecommendedEvents(recommendations);
      } catch (error) {
        console.error("Failed to load recommendations:", error);
        // Fail gracefully - don't show error to user, just no recommendations
        setRecommendedEvents([]);
      } finally {
        setIsLoading(false);
      }
    }

    // Add debounce to avoid too frequent calls
    const timeoutId = setTimeout(loadRecommendations, 300);
    return () => clearTimeout(timeoutId);
  }, [allEvents, userPreferences, selectedCampus, userData]);

  // Convert FetchedEvent[] to Event[] format for EventsSection
  const eventsForSection = useMemo(() => {
    return recommendedEvents.map((event) => {
      const eventCard = toEventCard(event);
      
      // Add "Recommended" tag to the beginning of tags array
      const tags = ["Recommended", ...(eventCard.tags || [])];
      
      return {
        ...eventCard,
        tags,
      };
    });
  }, [recommendedEvents]);

  // Don't render if user shouldn't see recommendations
  if (!shouldShowRecommendations(userPreferences)) {
    return null;
  }

  // Don't render if no recommendations (after loading)
  if (!isLoading && eventsForSection.length === 0) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-[#063168]">
            Recommended for You
          </h2>
        </div>
        
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-200 animate-pulse rounded-lg"
              style={{ height: "320px" }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Render recommendations using existing EventsSection component
  return (
    <EventsSection
      title="Recommended for You"
      events={eventsForSection}
      baseUrl="event"
    />
  );
};