const crypto = require('crypto');
const { successResponse } = require('../utils/util');
const { stat } = require('fs');

const CARRIERS = {
    UPS: {
        name: 'UPS',
        services: {
            'ups-ground': { name: 'UPS Ground', deliveryDays: [3, 5], baseRate: 8.90 },
            'ups-3day': { name: 'UPS 3-Day Select', deliveryDays: [3, 3], baseRate: 15.99 },
            'ups-2day': { name: 'UPS 2nd Day Air', deliveryDays: [2, 2], baseRate: 22.99 },
            'ups-next-day': { name: 'UPS Next Day Air', deliveryDays: [1, 1], baseRate: 35.99 }
        }
    },
    FEDEX: {
        name: 'FedEx',
        services: {
            'fedex-ground': { name: 'FedEx Ground', deliveryDays: [3, 5], baseRate: 9.49 },
            'fedex-express': { name: 'FedEx Express Saver', deliveryDays: [3, 3], baseRate: 16.49 },
            'fedex-2day': { name: 'FedEx 2Day', deliveryDays: [2, 2], baseRate: 23.49 },
            'fedex-overnight': { name: 'FedEx Standard Overnight', deliveryDays: [1, 1], baseRate: 37.49 }
        }
    },
    USPS: {
        name: 'USPS',
        services: {
            'usps-ground': { name: 'USPS Ground Advantage', deliveryDays: [3, 7], baseRate: 6.99 },
            'usps-priority': { name: 'USPS Priority Mail', deliveryDays: [1, 3], baseRate: 12.99 },
            'usps-express': { name: 'USPS Priority Mail Express', deliveryDays: [1, 2], baseRate: 28.99 }
        }
    }
};

const TRACKING_STATUSES = [
    'Label Created',
    'Package Picked Up',
    'In Transit',
    'Arrived at Facility',
    'Out for Delivery',
    'Delivered'
];

const mockShipmentDB = new Map();
const mockTrackingDB = new Map();

class MockShippingService {

    async calculateRates(packageInfo, destination) {
        try {
            // API delay simulation
            await this._delay(500, 1500);

            this._validatePackageInfo(packageInfo);
            this._validateDestination(destination);

            const rates = [];

            for (const [carrierCode, carrier] of Object.entries(CARRIERS)) {
                for (const [serviceCode, service] of Object.entries(carrier.services)) {
                    const rate = this._calculateRate(packageInfo, destination, service);

                    const finalRate = this._addRateVariation(rate);

                    rates.push({
                        carrierId: carrierCode,
                        carrierName: carrier.name,
                        serviceId: serviceCode,
                        serviceName: service.name,
                        rate: parseFloat(finalRate.toFixed(2)),
                        estimatedDeliveryDays: this._getRandomDeliveryDays(service.deliveryDays),
                        estimatedDeliveryDate: this._getEstimatedDeliveryDate(service.deliveryDays)
                    });
                }

            }

            rates.sort((a, b) => a.rate - b.rate);

            return {
                success: true,
                rates,
                requestId: this._generateRequestId()
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                rates: []
            };
        }
    }

    async createShippingLabel(orderInfo, selectedRate, destination) {
        try {
            // API delay simulation
            await this._delay(1000, 2000);

            if (!selectedRate || !selectedRate.carrierId || !selectedRate.serviceId) {
                throw new Error('Invalid shipping rate selection');
            }

            const trackingNumber = this._generateTrackingNumber(selectedRate.carrierId);
            const shipmentId = this._generateShipmentId();

            const shipment = {
                shipmentId,
                trackingNumber,
                carrierId: selectedRate.carrierId,
                carrierName: selectedRate.carrierName,
                serviceId: selectedRate.serviceId,
                serviceName: selectedRate.serviceName,
                orderId: orderInfo.id,
                destination,
                packageInfo: orderInfo.packageInfo,
                rate: selectedRate.rate,
                status: 'Label Created',
                createdAt: new Date(),
                estimatedDeliveryDate: selectedRate.estimatedDeliveryDate,
                labelUrl: `https://shippinglabels.example.com/${shipmentId}.pdf`
            };

            mockShipmentDB.set(shipmentId, shipment);

            await this._initializeTracking(trackingNumber, shipment);

            // Occasional failure simulation (5% chance)
            if (Math.random() < 0.05) {
                throw new Error('Carrier API temporarily unavailable');
            }

            return {
                success: true,
                shipmentId,
                trackingNumber,
                labelUrl: `https://shippinglabels.example.com/${shipmentId}.pdf`,
                rate: selectedRate.rate,
                estimatedDeliveryDate: selectedRate.estimatedDeliveryDate,
                carrier: {
                    id: selectedRate.carrierId,
                    name: selectedRate.carrierName,
                    service: selectedRate.serviceName
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async trackShipment(trackingNumber) {
        try {
            // Simulate API delay
            await this._delay(300, 800);

            const trackingEvents = mockTrackingDB.get(trackingNumber);

            if (!trackingEvents) {
                return {
                    success: false,
                    error: 'Tracking number not found'
                };
            }

            // Simulate tracking progression over time
            await this._updateTrackingProgress(trackingNumber);

            const updatedEvents = mockTrackingDB.get(trackingNumber);
            const latestEvent = updatedEvents[updatedEvents.length - 1];

            return {
                success: true,
                trackingNumber,
                status: latestEvent.status,
                estimatedDeliveryDate: latestEvent.estimatedDeliveryDate,
                events: updatedEvents.map(event => ({
                    status: event.status,
                    description: event.description,
                    location: event.location,
                    timestamp: event.timestamp
                }))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async cancelShipment(shipmentId) {
        try {
            await this._delay(500, 1000);

            const shipment = mockShipmentDB.get(shipmentId);

            if (!shipment) {
                return {
                    success: false,
                    error: 'Shipment not found'
                };
            }

            if (shipment.status !== 'Label Created') {
                return {
                    success: false,
                    error: 'Cannot cancel shipment that has already been picked up'
                };
            }

            shipment.status = 'Cancelled';
            shipment.cancelledAt = new Date();

            return {
                success: true,
                message: 'Shipment cancelled successfully',
                refund: shipment.rate * 0.9 // 10% processing rate
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Private helper methods
    _validatePackageInfo(packageInfo) {
        const required = ['weight', 'dimensions'];
        for (const field of required) {
            if (!packageInfo[field]) {
                throw new Error(`Package ${field} is required`);
            }
        }

        if (packageInfo.weight <= 0) {
            throw new Error('Package weight must be greater than zero');
        }

        const { length, width, height } = packageInfo.dimensions;
        if (!length || !width || !height) {
            throw new Error('Package dimensions (length, width, height) are required');
        }
    }

    _validateDestination(destination) {
        const required = ['country', 'state', 'city', 'postalCode'];
        for (const field of required) {
            if (!destination[field]) {
                throw new Error(`Destination ${field} is required`);
            }
        }
    }

    _calculateRate(packageInfo, destination, service) {
        const { weight, dimensions } = packageInfo;
        const { length, width, height } = dimensions;

        // Calculate dimensional weight
        const dimWeight = (length * width * height) / 166; // DIM divisor
        const billableWeight = Math.max(weight, dimWeight);

        // Base rate calculation
        let rate = service.baseRate;

        // Weight-based pricing
        if (billableWeight > 1) {
            rate += (billableWeight - 1) * 2.5;
        }

        // Distance/zone pricing (simplified)
        if (destination.country !== 'US') {
            rate *= 2.5; // International multiplier
        } else if (destination.state !== 'CA') {
            rate *= 1.2; // Cross-country multiplier
        }

        // Package size surcharges
        const maxDimension = Math.max(length, width, height);
        if (maxDimension > 48) {
            rate += 15; // Oversized package fee
        }

        return rate;
    }

    _addRateVariation(baseRate) {
        // Add ±5% variation to simulate real-world rate fluctuations
        const variation = (Math.random() - 0.5) * 0.1;
        return baseRate * (1 + variation);
    }

    _getRandomDeliveryDays(range) {
        const [min, max] = range;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    _calculateDeliveryDate(deliveryDaysRange) {
        const days = this._getRandomDeliveryDays(deliveryDaysRange);
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + days);

        // Skip weekends for business days
        while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
            deliveryDate.setDate(deliveryDate.getDate() + 1);
        }

        return deliveryDate.toISOString().split('T')[0];
    }

    _generateTrackingNumber(carrierId) {
        const prefix = {
            'UPS': '1Z',
            'FedEx': '1234',
            'USPS': '9400'
        }[carrierId] || '';

        const randomDigits = crypto.randomBytes(8).toString('hex').toUpperCase();
        return `${prefix}${randomDigits}`;
    }

    _generateShipmentId() {
        return 'SHIP_' + crypto.randomBytes(8).toString('hex').toUpperCase();
    }

    _generateRequestId() {
        return 'REQ_' + crypto.randomBytes(6).toString('hex').toUpperCase();
    }

    async _initializeTracking(trackingNumber, shipment) {
        const events = [{
            status: 'Label Created',
            description: 'Shipping label created',
            location: 'Origin Facility',
            timestamp: new Date(),
            estimatedDeliveryDate: shipment.estimatedDeliveryDate
        }];

        mockTrackingDB.set(trackingNumber, events);
    }

    async _updateTrackingProgress(trackingNumber) {
        const events = mockTrackingDB.get(trackingNumber);
        if (!events) return;

        const createdAt = events[0].timestamp;
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

        // Tracking progression simulation
        let targetStatusIndex = 0;

        if (hoursSinceCreation > 2) targetStatusIndex = 1; // package picked up
        if (hoursSinceCreation > 6) targetStatusIndex = 2; // in transit
        if (hoursSinceCreation > 24) targetStatusIndex = 3; // arrived at facility
        if (hoursSinceCreation > 48) targetStatusIndex = 4; // out for delivery
        if (hoursSinceCreation > 72) targetStatusIndex = 5; // delivered
        
        // Add missing events up to current status
        const currentStatusIndex = events.length -1;

        for (let i = currentStatusIndex + 1; i <= targetStatusIndex; i++) {
            const newEvent = {
                status : TRACKING_STATUSES[i],
                description: this._getStatusDescription(TRACKING_STATUSES[i]),
                location: this._getRandomLocation(),
                timestamp: new Date(createdAt.getTime() + (i * 12 * 60 * 60 * 1000)),
                estimatedDeliveryDate: events[0].estimatedDeliveryDate
            };
            
            events.push(newEvent);
        }

        mockTrackingDB.set(trackingNumber, events);
    }

    _getStatusDescription(status) {
        const descriptions = {
            'Label Created': 'Shipping label created and ready for pickup',
            'Package Picked Up': 'Package picked up by carrier',
            'In Transit': 'Package is on its way to destination',
            'Arrived at Facility': 'Package arrived at sorting facility',
            'Out for Delivery': 'Package is out for delivery',
            'Delivered': 'Package delivered successfully'
        };
        return descriptions[status] || status;
    }

    _getRandomLocation() {
        const locations = [
            'Los Angeles, CA',
            'Phoenix, AZ',
            'Denver, CO',
            'Chicago, IL',
            'Atlanta, GA',
            'New York, NY'
        ];
        return locations[Math.floor(Math.random() * locations.length)];
    }

    async _delay(minMs, maxMs) {
        const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
        return new Promise(resolve => setTimeout(resolve, delay));
    }
}

module.exports = new MockShippingService();