/**
 * @fileoverview Ottehr Order Management Component
 * 
 * React component demonstrating the Ottehr integration for order management
 * in the WebQX patient portal.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id?: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface OttehrOrderManagerProps {
  patientId: string;
  onOrderCreated?: (order: Order) => void;
  onError?: (error: string) => void;
}

const OttehrOrderManager: React.FC<OttehrOrderManagerProps> = ({
  patientId,
  onOrderCreated,
  onError
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [newOrder, setNewOrder] = useState<Omit<Order, 'id' | 'createdAt' | 'updatedAt'>>({
    customerId: patientId,
    items: [{
      productId: '',
      name: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0
    }],
    totalAmount: 0,
    currency: 'USD'
  });

  // Calculate total amount when items change
  useEffect(() => {
    const total = newOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    setNewOrder(prev => ({ ...prev, totalAmount: total }));
  }, [newOrder.items]);

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
    const updatedItems = [...newOrder.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Calculate total price for the item
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? Number(value) : updatedItems[index].quantity;
      const unitPrice = field === 'unitPrice' ? Number(value) : updatedItems[index].unitPrice;
      updatedItems[index].totalPrice = quantity * unitPrice;
    }
    
    setNewOrder(prev => ({ ...prev, items: updatedItems }));
  };

  const addItem = () => {
    setNewOrder(prev => ({
      ...prev,
      items: [...prev.items, {
        productId: '',
        name: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0
      }]
    }));
  };

  const removeItem = (index: number) => {
    if (newOrder.items.length > 1) {
      const updatedItems = newOrder.items.filter((_, i) => i !== index);
      setNewOrder(prev => ({ ...prev, items: updatedItems }));
    }
  };

  const createOrder = async () => {
    if (newOrder.items.some(item => !item.productId || !item.name || item.quantity <= 0)) {
      onError?.('Please fill in all required fields for each item');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ottehr/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newOrder)
      });

      const result = await response.json();
      
      if (result.success) {
        setOrders(prev => [...prev, result.data]);
        onOrderCreated?.(result.data);
        
        // Reset form
        setNewOrder({
          customerId: patientId,
          items: [{
            productId: '',
            name: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0
          }],
          totalAmount: 0,
          currency: 'USD'
        });
      } else {
        onError?.(result.error?.message || 'Failed to create order');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const sendOrderNotification = async (orderId: string) => {
    try {
      const response = await fetch('/api/ottehr/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'order_update',
          recipientId: patientId,
          title: 'Order Update',
          message: `Your order ${orderId} has been confirmed and is being processed.`,
          channels: ['email', 'in_app']
        })
      });

      const result = await response.json();
      if (!result.success) {
        onError?.(result.error?.message || 'Failed to send notification');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to send notification');
    }
  };

  return (
    <div className="ottehr-order-manager" style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>Prescription Orders</h2>
      
      {/* Create New Order Form */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Create New Order</h3>
        
        {newOrder.items.map((item, index) => (
          <div key={index} style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px 100px auto', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Product ID"
                value={item.productId}
                onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <input
                type="text"
                placeholder="Product Name"
                value={item.name}
                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <input
                type="number"
                placeholder="Qty"
                min="1"
                value={item.quantity}
                onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <input
                type="number"
                placeholder="Price"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <div style={{ padding: '8px', fontWeight: 'bold' }}>
                ${item.totalPrice.toFixed(2)}
              </div>
              <button
                onClick={() => removeItem(index)}
                disabled={newOrder.items.length === 1}
                style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#ff4444', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: newOrder.items.length === 1 ? 'not-allowed' : 'pointer',
                  opacity: newOrder.items.length === 1 ? 0.5 : 1
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        
        <div style={{ marginBottom: '15px' }}>
          <button
            onClick={addItem}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Add Item
          </button>
          
          <div style={{ display: 'inline-block', marginLeft: '20px', fontSize: '18px', fontWeight: 'bold' }}>
            Total: ${newOrder.totalAmount.toFixed(2)} {newOrder.currency}
          </div>
        </div>
        
        <button
          onClick={createOrder}
          disabled={loading}
          style={{ 
            padding: '12px 24px', 
            backgroundColor: loading ? '#ccc' : '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          {loading ? 'Creating Order...' : 'Create Order'}
        </button>
      </div>

      {/* Orders List */}
      {orders.length > 0 && (
        <div>
          <h3>Your Orders</h3>
          {orders.map((order) => (
            <div key={order.id} style={{ 
              marginBottom: '15px', 
              padding: '15px', 
              border: '1px solid #ddd', 
              borderRadius: '8px',
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0 }}>Order #{order.id}</h4>
                <span style={{ 
                  padding: '4px 8px', 
                  backgroundColor: order.status === 'pending' ? '#ffc107' : '#28a745',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}>
                  {order.status?.toUpperCase()}
                </span>
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <strong>Items:</strong>
                {order.items.map((item, index) => (
                  <div key={index} style={{ marginLeft: '15px' }}>
                    {item.name} (x{item.quantity}) - ${item.totalPrice.toFixed(2)}
                  </div>
                ))}
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <strong>Total: ${order.totalAmount.toFixed(2)} {order.currency}</strong>
              </div>
              
              <div style={{ fontSize: '12px', color: '#666' }}>
                Created: {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
              </div>
              
              <button
                onClick={() => sendOrderNotification(order.id!)}
                style={{ 
                  marginTop: '10px',
                  padding: '8px 16px', 
                  backgroundColor: '#17a2b8', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Send Update Notification
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OttehrOrderManager;