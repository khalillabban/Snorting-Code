import { RouteStrategy } from '../services/Routing';

export const WALKING_STRATEGY: RouteStrategy = {
  mode: 'walking',
  label: 'Walk', 
  icon: 'walk' //used to render expo icons
};

export const BIKING_STRATEGY: RouteStrategy = {
  mode: 'bicycling',
  label: 'Bike',
  icon: 'bicycle'
};

export const DRIVING_STRATEGY: RouteStrategy = {
    mode: 'driving',
    label: 'Car',
    icon: 'car'
}

export const TRANSIT_STRATEGY: RouteStrategy = {
  mode: 'transit',
  label: 'Transit',
  icon: 'bus',
};

// Helper to get all strategies for a UI loop
export const ALL_STRATEGIES = [WALKING_STRATEGY, BIKING_STRATEGY, DRIVING_STRATEGY, TRANSIT_STRATEGY];