const mockShippingService = require('../services/mockShippingService');
const Order = require('../models/Order');
const { requireFields, successResponse, errorResponse } = require('../utils/util');
const { ObjectId } = require('mongoose').Types;

const calculateShippingRates = async (req, res) => {
    const { packageInfo, destination } = req.body;

    const errMsg = requireFields(req.body, ['packageInfo', 'destination']);
    if (errMsg) return errorResponse(res, errMsg, 400);

    try {
        const packageFields = ['weight', 'dimensions'];
        for (const field of packageFields) {
            if (!packageInfo[field]) {
                return errorResponse(res, `Missing packageInfo field: ${field}`, 400);
            }
        }

        const { length, width, height } = packageInfo.dimensions;
        if (!length || !width || !height) {
            return errorResponse(res, 'Missing packageInfo.dimensions fields', 400);
        }

        const destFields = ['country', 'city', 'postalCode'];
        for (const field of destFields) {
            if (!destination[field]) {
                return errorResponse(res, `Missing destination field: ${field}`, 400);
            }
        }

        const result = await mockShippingService.calculateRates(packageInfo, destination);

        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        return successResponse(res, {
            rates: result.rates,
            requestId: result.requestId
        }, 'Shipping rates calculated successfully');
    } catch (error) {
        console.error('Error calculating shipping rates:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const createShippingLabel = async (req, res) => {
    const { orderId, selectedRate, packageInfo } = req.body;

    const errMsg = requireFields(req.body, ['orderId', 'selectedRate', 'packageInfo']);
    if (errMsg) return errorResponse(res, errMsg, 400);

    try {
        if (!ObjectId.isValid(orderId)) {
            return errorResponse(res, 'Invalid orderId', 400);
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return errorResponse(res, 'Order not found', 404);
        }

        const isAdmin = req.user.role === 'admin';
        if (!isAdmin && String(order.user) !== String(req.user._id)) {
            return errorResponse(res, 'Unauthorized', 403);
        }

        if (!selectedRate.carrierId || !selectedRate.serviceId) {
            return errorResponse(res, 'Invalid shipping rate selection', 400);
        }

        const orderInfo = {
            orderId: order._id,
            packageInfo,
            customerInfo: {
                userId: order.user,
                email: req.user.email
            }
        };

        const destination = order.shippingAddress;

        const result = await mockShippingService.createShippingLabel(orderInfo, selectedRate, destination);

        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        order.shippingInfo = {
            shipmentId: result.shipmentId,
            trackingNumber: result.trackingNumber,
            carrier: result.carrier,
            shippingCost: result.rate,
            labelUrl: result.labelUrl,
            estimatedDeliveryDate: result.estimatedDeliveryDate,
            createdAt: new Date()
        };

        if (order.status === 'paid') {
            order.status = 'shipped';
        }

        await order.save();

        return successResponse(res, {
            shipmentId: result.shipmentId,
            trackingNumber: result.trackingNumber,
            labelUrl: result.labelUrl,
            carrier: result.carrier,
            shippingCost: result.rate,
            estimatedDeliveryDate: result.estimatedDeliveryDate
        }, 'Shipping label created successfully', 201);
    } catch (error) {
        console.error('Error creating shipping label:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const trackShipment = async (req, res) => {
    const { trackingNumber } = req.params;

    if (!trackingNumber) {
        return errorResponse(res, 'Missing trackingNumber parameter', 400);
    }

    try {
        const result = await mockShippingService.trackShipment(trackingNumber);

        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        return successResponse(res, {
            trackingNumber: result.trackingNumber,
            status: result.status,
            estimatedDeliveryDate: result.estimatedDeliveryDate,
            events: result.events
        }, 'Shipment tracking retrieved successfully');
    } catch (error) {
        console.error('Error tracking shipment:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const getOrderShipping = async (req, res) => {
    const { orderId } = req.params;

    if (!ObjectId.isValid(orderId)) {
        return errorResponse(res, 'Invalid orderId', 400);
    }

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return errorResponse(res, 'Order not found', 404);
        }

        const isAdmin = req.user.role === 'admin';
        if (!isAdmin && String(order.user) !== String(req.user._id)) {
            return errorResponse(res, 'Unauthorized', 403);
        }

        if(!order.shippingInfo) {
            return errorResponse(res, 'Shipping information not found', 404);
        }

        let trackingInfo = null;
        if (order.shippingInfo.trackingNumber) {
            const trackingResult = mockShippingService.trackShipment(order.shippingInfo.trackingNumber);
            if (trackingResult.success) {
                trackingInfo = {
                    status: trackingResult.status,
                    estimatedDeliveryDate: trackingResult.estimatedDeliveryDate,
                    events: trackingResult.events
                };
            }
        }

        return successResponse(res, {
            shippingInfo: order.shippingInfo,
            tracking: trackingInfo
        }, 'Order shipping information retrieved successfully');
    } catch (error) {
        console.error('Error retrieving order shipping information:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const cancelShipment = async (req, res) => {
    const {  shipmentId } = req.params;

    if (!shipmentId) {
        return errorResponse(res, 'Missing shipmentId parameter', 400);
    }

    try {
        const result = await mockShippingService.cancelShipment(shipmentId);

        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        const order = await Order.findOne({ 'shippingInfo.shipmentId': shipmentId });
        if (order) {
            order.shippingInfo = 'cancelled';
            order.shippingInfo.cancelledAt = new Date();

            if (order.status === 'shipped') {
                order.status = 'paid';
            }

            await order.save();
        }

        return successResponse(res, {
            message: result.message,
            refund: result.refund
        }, 'Shipment canceled successfully');
    } catch (error) {
        console.error('Error canceling shipment:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

module.exports = {
    calculateShippingRates,
    createShippingLabel,
    trackShipment,
    getOrderShipping,
    cancelShipment
};