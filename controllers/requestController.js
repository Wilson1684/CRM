const db = require("../utils/database");
const admin = require("firebase-admin");

// Create Request Form Controller
async function createRequestForm(req, res) {
  console.log("Creating form", req.body);
  const { technician_name, customer_name, equipment, brand, parts_needed, order_id } = req.body;

  // Validate required fields
  if (!technician_name || !customer_name || !equipment || !brand || !parts_needed || !order_id) {
    return res.status(400).json({ message: "All fields including order_id are required" });
  }

  try {
    // Use string interpolation to build the query
    const createRequestFormQuery = `
            INSERT INTO request_forms (technician_name, customer_name, equipment, brand, parts_needed, status, order_id, isSeen) 
            VALUES ('${technician_name}', '${customer_name}', '${equipment}', '${brand}', '${parts_needed}', 'pending', '${order_id}', 'unseen')
        `;

    // Execute the query
    const result = await new Promise((resolve, reject) => {
      db.query(createRequestFormQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    res.status(201).json({ message: 'Request Form submitted!', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to Submit Request Form' });
  }
}


// Update Request Form Status Controller
function updateRequestFormStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  // Validate status
  if (!status || !['complete', 'pending'].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  // Update request form status
  const updateRequestFormQuery = `
  UPDATE request_forms
  SET 
    status = '${status}', 
    arrival_time = NOW()
  WHERE id = '${id}';
`;


  db.query(updateRequestFormQuery, (error, results) => {
    if (error) {
      return res.status(500).json({ message: "Database error", error });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Request form not found" });
    }

    // Check if the status is "completed" to update stockAmount
    if (status === 'complete') {
      // Query to reduce stock amount by 1 in inventory based on parts_needed in request_forms
      const reduceStockQuery = `
        UPDATE inventory 
        SET stockAmount = stockAmount - 1 
        WHERE name = (
          SELECT parts_needed FROM request_forms WHERE id = '${id}'
        ) AND stockAmount > 0;
      `;

      db.query(reduceStockQuery, (error, stockResults) => {
        if (error) {
          return res.status(500).json({ message: "Error updating stock amount", error });
        }

        const orderIdQuery = `SELECT order_id FROM request_forms WHERE id=${id}`;

        db.query(orderIdQuery, (error, orderResult) => {
          if (error || !orderResult.length) {
            console.error("Error retrieving order ID:", error);
            return res.status(500).json({ message: "Order not found", status: 500 });
          }

          const orderId = orderResult[0].order_id;

          // Query for customer_id using the order_id
          const customerIdQuery = `SELECT technician_id FROM ordertable WHERE order_id=${orderId}`;

          db.query(customerIdQuery, (error, customerResult) => {
            if (error || !customerResult.length) {
              console.error("Error retrieving customer ID:", error);
              return res.status(500).json({ message: "Customer not found", status: 500 });
            }

            const customerId = customerResult[0].technician_id;

            // Query for FCM token using customer_id
            const tokenQuery = `SELECT fcm_token FROM technician WHERE technician_id=${customerId}`;

            db.query(tokenQuery, (error, tokenResult) => {
              if (error || !tokenResult.length) {
                console.error("Error retrieving FCM token:", error);
                return res.status(500).json({ message: "Token not found", status: 500 });
              }

              const registrationToken = tokenResult[0].fcm_token;

              // Send FCM notification
              const sendNotification = async (registrationToken) => {
                const messageSend = {
                  token: registrationToken,
                  notification: {
                    title: "Spare-part is available!",
                    body: `Spare-part is ready to be pick up.`
                  },
                  data: {
                    key1: "value1",
                    key2: "value2"
                  },
                  android: {
                    priority: "high"
                  },
                  apns: {
                    payload: {
                      aps: {
                        badge: 42
                      }
                    }
                  }
                };

                try {
                  const response = await admin.messaging().send(messageSend);
                  console.log("Successfully sent message:", response);
                } catch (error) {
                  console.error("Error sending message:", error);
                }
              };

              // Call the sendNotification function with the retrieved token and technician name
              sendNotification(registrationToken);
            });
          });
        });
        // Check if stock was successfully reduced
        if (stockResults.affectedRows === 0) {
          return res.status(404).json({ message: "Stock not available or item not found in inventory" });
        }
        return res.status(200).json({ message: "Request form status updated and stock adjusted successfully" });
      });
    } else {
      // If the status is not "complete," just return success for the status update
      return res.status(200).json({ message: "Request form status updated successfully" });
    }
  });
}

// get technician forms
async function getRequestFormsByTechnician(req, res) {
  const { name } = req.params;

  // Validate the name parameter
  if (!name) {
    return res.status(400).json({ message: "Technician name is required" });
  }

  try {
    // Use string interpolation to build the query, using LIKE for partial matching
    const getRequestFormsByTechnicianQuery = `
      SELECT * FROM request_forms 
      WHERE technician_name LIKE '%${name}%'
    `;

    // Execute the query
    const result = await new Promise((resolve, reject) => {
      db.query(getRequestFormsByTechnicianQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (result.length === 0) {
      return res.status(404).json({ message: "No request forms found for this technician" });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve request forms" });
  }
}
// Get All Request Forms Controller
function getAllRequestForms(req, res) {
  console.log("Getting alll form ============")
  // Use string interpolation for the query
  const getAllRequestFormsQuery = "SELECT * FROM request_forms";

  // Execute the query
  db.query(getAllRequestFormsQuery, (error, rows) => {
    if (error) {
      return res.status(500).json({ message: "Database error", error });
    }
    return res.status(200).json(rows);
  });
}
// Delete Request Form Controller
function deleteRequestForm(req, res) {
  const { id } = req.params;

  // Use string interpolation to build the query
  const deleteRequestFormQuery = `
        DELETE FROM request_forms
        WHERE id = '${id}'
    `;

  // Execute the query
  db.query(deleteRequestFormQuery, (error, results) => {
    if (error) {
      return res.status(500).json({ message: "Database error", error });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Request form not found" });
    }
    return res.status(200).json({ message: "Request form deleted successfully" });
  });
}




function getRequestFormById(req, res) {
  const { id } = req.params;

  // Use string interpolation to build the query
  const getRequestFormByIdQuery = `
        SELECT * FROM request_forms
        WHERE id = '${id}'
    `;

  // Execute the query
  db.query(getRequestFormByIdQuery, (error, results) => {
    if (error) {
      return res.status(500).json({ message: "Database error", error });
    }

    const isSeenQuery = `UPDATE request_forms SET isSeen = 'seen' WHERE id=${id}`;

    db.query(isSeenQuery, (error, isSeenResult) => {
      if (error) {
        console.error('Error updating isSeen:', err);
        return res.status(500).json({ error: 'Failed to update isSeen' });
      }
    });

    if (results.length === 0) {
      return res.status(404).json({ message: "Request form not found" });
    }
    return res.status(200).json(results[0]);
  });
}

function trackOrderStatus(req, res) {
  const technicianId = req.params.technicianId;
  const orderId = req.params.orderId;

  console.log('Received technicianId:', technicianId);
  console.log('Received orderId:', orderId);

  const queryString = `
    SELECT status, created_at 
    FROM request_forms 
    WHERE order_id = ${orderId};
  `;

  db.query(queryString, (err, results) => {
    if (err) {
      console.error('Error executing database query:', err);
      return res.status(500).json({ error: 'Database query error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderStatus = results[0].status;
    const requestTime = new Date(results[0].created_at);
    const currentTime = new Date();
    const timeDifference = (currentTime - requestTime) / (1000 * 60); // Time in minutes

    console.log('Order status:', orderStatus);
    console.log('Time since request creation (minutes):', timeDifference);

    // Case 1: If pending and less than 20 minutes, schedule a re-check
    if (orderStatus === 'pending' && timeDifference < 20) {
      console.log('Scheduling a status re-check in 20 minutes...');
      setTimeout(() => {
        checkOrderStatusAndUpdateTechnician(technicianId, orderId);
      }, (20 - timeDifference) * 60 * 1000); // Remaining time to reach 20 minutes
      return res.status(200).json({ message: 'Status check scheduled for 20 minutes later.' });
    }

    // Case 2: Perform immediate update based on status after 20 minutes
    checkOrderStatusAndUpdateTechnician(technicianId, orderId);
    res.status(200).json({ message: 'Immediate status check performed.' });
  });
}

// Helper Function: Re-check order status and update technician
function checkOrderStatusAndUpdateTechnician(technicianId, orderId) {
  const queryString = `
    SELECT status, created_at 
    FROM request_forms 
    WHERE order_id = ${orderId};
  `;

  db.query(queryString, (err, results) => {
    if (err) {
      console.error('Error executing database query:', err);
      return;
    }

    if (results.length === 0) {
      console.error('Order not found during re-check');
      return;
    }

    const orderStatus = results[0].status;
    const requestTime = new Date(results[0].created_at);
    const currentTime = new Date();
    const timeDifference = (currentTime - requestTime) / (1000 * 60); // Time in minutes

    console.log('Re-checking order status:', orderStatus);
    console.log('Time difference (minutes):', timeDifference);

    if (orderStatus === 'complete') {
      const updateTechnicianQuery = `
        UPDATE technician 
        SET status = 'working' 
        WHERE technician_id = ${technicianId};
      `;
      db.query(updateTechnicianQuery, (err) => {
        if (err) {
          console.error('Error updating technician status to working:', err);
          return;
        }
        console.log('Technician status updated to working.');
      });


    } else if (orderStatus === 'pending' && timeDifference >= 20) {
      const updateTechnicianQuery = `
        UPDATE technician 
        SET status = 'free' 
        WHERE technician_id = ${technicianId};
      `;
      db.query(updateTechnicianQuery, (err) => {
        if (err) {
          console.error('Error updating technician status to free:', err);
          return;
        }
        console.log('Technician status updated to free after 20 minutes.');
      });
    }
  });
}

// // Controller Function: Update the status of an order
// const updateOrderStatus = (req, res) => {
//   const { id, newStatus } = req.body; // Use 'id' instead of 'orderId'

//   if (!id || !newStatus) {
//     return res.status(400).json({ error: 'id and newStatus are required' });
//   }

//   const updateStatusQuery = `
//     UPDATE request_forms 
//     SET status = '${newStatus}' 
//     WHERE id = ${id};
//   `;

//   db.query(updateStatusQuery, (err, result) => {
//     if (err) {
//       console.error('Error updating order status:', err);
//       return res.status(500).json({ error: 'Database query error' });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: 'Order not found or status not updated' });
//     }

//     console.log(`Order status updated to '${newStatus}' for id:`, id);

//     // Trigger webhook if status is 'complete'
//     if (newStatus === 'complete') {
//       const webhookUrl = 'http://68.183.182.216:5005/dashboarddatabase/recordCompletionTime';
//       const payload = { id, status: newStatus };

//       const axios = require('axios');
//       axios.put(webhookUrl, payload)
//         .then(response => {
//           console.log('Webhook triggered successfully:', response.data);
//         })
//         .catch(error => {
//           console.error('Error triggering webhook:', error.message);
//         });
//     }

//     return res.status(200).json({ message: 'Order status updated successfully', id });
//   });
// };

// // Controller Function: Record the current time when status is 'complete'
// const recordCompletionTime = (req, res) => {
//   const { id, status } = req.body; // Use 'id' instead of 'orderId'

//   if (!id || !status) {
//     return res.status(400).json({ error: 'id and status are required' });
//   }

//   if (status !== 'complete') {
//     return res.status(400).json({ error: 'Completion time can only be recorded for status "complete"' });
//   }

//   const updateCompletionTimeQuery = `
//     UPDATE request_forms 
//     SET arrival_time = NOW() 
//     WHERE id = ${id} AND status = 'complete';
//   `;

//   db.query(updateCompletionTimeQuery, (err, result) => {
//     if (err) {
//       console.error('Error recording completion time:', err);
//       return res.status(500).json({ error: 'Database query error' });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: 'Order not found or not in "complete" status' });
//     }

//     console.log('Completion time recorded for id:', id);
//     return res.status(200).json({ message: 'Completion time recorded successfully', id });
//   });
// };





function checkAvailability(req, res) {
  console.log("checkAvailability API hit");

  const { type } = req.user || {}; // Safely access req.user
  console.log("User type:", type);

  // Temporarily bypass admin check
  // if (type !== "admin") {
  //   console.log("Unauthorized access attempt. User type:", type);
  //   return res.status(401).json({ message: "Unauthorized" });
  // }

  const query = `
    SELECT 
  rf.parts_needed, 
  COALESCE(i.name, 'Not Found') AS inventory_name,
  COALESCE(i.stockAmount, 0) AS stockAmount,
  CASE 
    WHEN i.name IS NULL THEN 'Not Available'  -- If no matching part in inventory
    WHEN i.stockAmount > 0 THEN 'Available'   -- If stock > 0
    ELSE 'Not Available'                      -- If stock is 0 or less
  END AS availability
FROM 
  request_forms rf
LEFT JOIN 
  inventory i 
ON 
  LOWER(rf.parts_needed) = LOWER(i.name);  -- Ensure case-insensitive matching

  `;

  console.log("Executing query...");

  db.query(query, (err, rows) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ error: 'Database query error' });
    }

    console.log("Query results:", rows);

    if (rows.length === 0) {
      console.log("No matching parts found in inventory.");
      return res.status(404).json({ message: "No matching parts found in inventory" });
    }

    res.status(200).json(rows);
  });
}

function getRequestFormByOrderId(req, res) {
  const { order_id } = req.params;

  // Use string interpolation to build the query
  const getRequestFormByOrderIdQuery = `
        SELECT * FROM request_forms
        WHERE order_id = '${order_id}'
    `;

  // Execute the query
  db.query(getRequestFormByOrderIdQuery, (error, results) => {
    if (error) {
      return res.status(500).json({ message: "Database error", error });
    }

    // Check if the request form exists
    if (results.length === 0) {
      return res.status(404).json({ message: "Request form not found" });
    }

    // Update the isSeen status for the specific order_id
    const isSeenQuery = UPDATE `request_forms SET isSeen = 'seen' WHERE order_id='${order_id}'`;

    db.query(isSeenQuery, (error) => {
      if (error) {
        console.error('Error updating isSeen:', error);
        return res.status(500).json({ error: 'Failed to update isSeen' });
      }
    });

    return res.status(200).json(results[0]);
  });
}


module.exports = {
  createRequestForm,
  updateRequestFormStatus,
  getAllRequestForms,
  deleteRequestForm,
  getRequestFormById,
  getRequestFormsByTechnician,
  trackOrderStatus,
  checkAvailability,
  getRequestFormByOrderId
};
