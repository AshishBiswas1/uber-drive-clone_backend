// services/FareService.js - All business logic here
class FareService {
  static calculateDistance(pickupLocation, dropoffLocation) {
    const lat1 = pickupLocation.coordinates[1];
    const lon1 = pickupLocation.coordinates[0];
    const lat2 = dropoffLocation.coordinates[1];
    const lon2 = dropoffLocation.coordinates[0];

    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100;
  }

  static calculateSurgePricing() {
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    const isPeakHour =
      (currentHour >= 7 && currentHour <= 10) ||
      (currentHour >= 17 && currentHour <= 20);
    const isWeekend = currentDay === 0 || currentDay === 6;
    const isLateNight = currentHour >= 22 || currentHour <= 5;

    let surgePricing = 1.0;

    if (isPeakHour) surgePricing = 1.5;
    if (isWeekend) surgePricing = Math.max(surgePricing, 1.3);
    if (isLateNight) surgePricing = Math.max(surgePricing, 1.4);

    const randomSurge = Math.random() > 0.8 ? 1.2 : 1.0;
    surgePricing = Math.max(surgePricing, randomSurge);

    return Math.round(surgePricing * 100) / 100;
  }

  static calculateFareEstimate(pickupLocation, dropoffLocation, vehicleType) {
    const distance = this.calculateDistance(pickupLocation, dropoffLocation);
    const surgePricing = this.calculateSurgePricing();
    const estimatedDuration = distance * 2;

    const fareRates = {
      Sedan: { base: 50, perKm: 12, perMin: 2 },
      SUV: { base: 80, perKm: 18, perMin: 3 },
      Van: { base: 100, perKm: 22, perMin: 4 },
    };

    const rate = fareRates[vehicleType];
    if (!rate) throw new Error('Invalid vehicle type');

    const estimatedFare = {
      baseFare: rate.base,
      distanceFare: Math.round(distance * rate.perKm),
      timeFare: Math.round(estimatedDuration * rate.perMin),
      surgePricing,
      totalFare: Math.round(
        (rate.base + distance * rate.perKm + estimatedDuration * rate.perMin) *
          surgePricing
      ),
      currency: 'Rupees',
    };

    return {
      estimatedFare,
      estimatedDistance: distance,
      estimatedDuration: Math.round(estimatedDuration),
    };
  }
}

module.exports = FareService;
