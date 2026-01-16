const db = require("../utils/database");
const admin = require("firebase-admin");

function createOrder(req, res) {
  const { userId, type } = req.user;

  // Ensure the user is a customer
  if (type !== "customer") {
    return res
      .status(401)
      .json({ message: "Only customers can create orders", status: 401 });
  }

  // Extract order details from the request
  const { order_detail, urgency_level, location_detail, problem_type, order_date, order_time } = req.body;
  const order_img = req.file ? `uploads/${req.file.filename}` : null;

  // Validate required fields
  if (!order_date || !order_time) {
    return res.status(400).json({ message: "Order date and time are required" });
  }

  // Convert order_time to MySQL-compatible format (HH:mm:ss)
  const timeParts = /(\d+):(\d+) (\w{2})/.exec(order_time);
  if (!timeParts) {
    return res.status(400).json({ message: "Invalid time format. Use HH:mm AM/PM" });
  }
  let [, hours, minutes, period] = timeParts; // Extract matched groups
  hours = parseInt(hours);
  if (period === 'PM' && hours !== 12) hours += 12; // Convert PM hours
  if (period === 'AM' && hours === 12) hours = 0; // Convert 12 AM to 00
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}:00`;

  // Construct the SQL query
  const createOrderQuery = `
    INSERT INTO ordertable (customer_id, problem_type, order_date, order_time, order_status, order_detail, order_img, urgency_level, location_details, price_status)
    VALUES (${userId}, '${problem_type}', '${order_date}', '${formattedTime}', 'pending', '${order_detail}', '${order_img}', '${urgency_level}', '${location_detail}', 'unpaid')
  `;

  // Execute the query
  db.query(createOrderQuery, (error, result) => {
    if (error) {
      console.error("Error creating order:", error);
      return res.status(500).json({ message: "Failed to create order" });
    }

    return res.status(201).json({ message: "success" });
  });
}




function deleteOrder(req, res) {

  const { id } = req.params;

  // Use string interpolation to build the query // new_addition 
  const deleteRequestFormQuery = `
        DELETE FROM ordertable
        WHERE order_id = '${id}'
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


function viewRequestDetail(req, res) {
  const { type } = req.user;
  const orderId = req.params.id;
  const status = req.query.status;
  // console.log(req.query);
  let dbQuery = "";
  if (status === "pending" || status === "cancelled") {
    console.log("inside here");
    dbQuery = `
    SELECT 
    ordertable.*,
    c.name AS customer_name,
    c.location AS customer_address,
    c.phone_number AS customer_phone_number,
    c.email as customer_email,
    c.auto_gate_brand as customer_auto_gate_brand,
    c.alarm_brand as customer_alarm_brand,
    c.auto_gate_warranty as customer_auto_gate_warranty
    c.alarm_warranty as customer_alarm_warranty
    FROM 
    ordertable
    JOIN 
    customer c ON ordertable.customer_id = c.customer_id
    WHERE 
    ordertable.order_id = ${orderId}
    `;
  } else {
    dbQuery = `
    SELECT 
    ordertable.*,
    c.name AS customer_name,
    c.location AS customer_address,
    c.phone_number AS customer_phone_number,
    c.email as customer_email,
    c.auto_gate_brand as customer_auto_gate_brand,
    c.alarm_brand as customer_alarm_brand,
    c.auto_gate_warranty as customer_auto_gate_warranty,
    c.alarm_warranty as customer_alarm_warranty,
    t.name AS technician_name,
    t.phone_number AS technician_phone_number,
    t.specialization AS technician_specialization
    FROM 
    ordertable
    JOIN 
    customer c ON ordertable.customer_id = c.customer_id
    JOIN 
    technician t ON ordertable.technician_id = t.technician_id
    WHERE 
    ordertable.order_id = ${orderId}
    `;
  }

  db.query(dbQuery, (error, results) => {
    if (error) {
      console.error("Error executing database query:", error);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Order not found", status: 404 });
    }
    const orderDetails = {
      orderId: results[0].order_id,
      orderDate: results[0].order_date,
      orderDoneDate: results[0].order_done_date,
      orderStatus: results[0].order_status,
      orderImage: results[0].order_img,
      orderDoneImage: results[0].order_done_img,
      orderDetail: results[0].order_detail,
      priority: results[0].urgency_level,
      locationDetail: results[0].location_detail,
      priceStatus: results[0].price_status,
      totalPrice: results[0].total_price,
      accept: results[0].accept,
      eventId: results[0].event_id,
      rating: results[0].rating,
      CreateAt: results[0].created_at,
      problem:
        (results[0]?.technician_specialization &&
          results[0].technician_specialization[0].toUpperCase() +
          results[0].technician_specialization.substring(1)) ||
        "",
      customer: {
        name: results[0].customer_name,
        address: results[0].customer_address,
        email: results[0].customer_email,
        phone: results[0].customer_phone_number,
        autogateBrand: results[0].customer_auto_gate_brand,
        alarmBrand: results[0].customer_alarm_brand,
        autogateWarranty: results[0].customer_auto_gate_warranty,
        alarmWarranty: results[0].customer_alarm_warranty,
      },
      technician: {
        name: results[0]?.technician_name || "",
        contactNumber: results[0]?.technician_phone_number || "",
        eta: results[0]?.technician_eta || "",
        startTime: results[0]?.technician_start_time || "",
        endTime: results[0]?.technician_stop_time || "",
      },
      userType: type,
    };

    return res.status(200).json({ status: 200, result: orderDetails });
  });
}

function getOrderDetail(req, res) {
  const orderId = req.params.id;
  const { status: orderStatus } = req.query;

  let dbQuery = `
    SELECT 
      ordertable.*,
      c.name AS customer_name,
      c.location AS customer_address,
      c.phone_number AS customer_phone_number,
      c.email as customer_email,
      c.auto_gate_brand as customer_auto_gate_brand,
      c.alarm_brand as customer_alarm_brand,
      c.auto_gate_warranty as customer_auto_gate_warranty,
      c.alarm_warranty as customer_alarm_warranty
    FROM 
      ordertable
    JOIN 
      customer c ON ordertable.customer_id = c.customer_id
  `;

  if (orderStatus !== "pending") {
    dbQuery += `
      JOIN 
        technician t ON ordertable.technician_id = t.technician_id
    `;
  }

  dbQuery += `
    WHERE 
      ordertable.order_id = ${orderId}
  `;

  db.query(dbQuery, (error, results) => {
    if (error) {
      console.error("Error executing database query:", error);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Order not found", status: 404 });
    }

    const orderDetails = {
      orderId: results[0].order_id,
      orderDate: results[0].order_date,
      orderDoneDate: results[0].order_done_date,
      orderStatus: results[0].order_status,
      orderImage: results[0].order_img,
      orderDoneImage: results[0].order_done_img,
      orderDetail: results[0].order_detail,
      priority: results[0].urgency_level,
      locationDetail: results[0].location_detail,
      priceStatus: results[0].price_status,
      totalPrice: results[0].total_price,
      eventId: results[0].event_id,
      CreateAt: results[0].created_at,
      problem:
        (results[0]?.technician_specialization &&
          results[0].technician_specialization[0].toUpperCase() +
          results[0].technician_specialization.substring(1)) ||
        "",
      customer: {
        name: results[0].customer_name,
        address: results[0].customer_address,
        email: results[0].customer_email,
        phone: results[0].customer_phone_number,
        autogateBrand: results[0].customer_auto_gate_brand,
        alarmBrand: results[0].customer_alarm_brand,
        autogateWarranty: results[0].customer_auto_gate_warranty,
        alarmWarranty: results[0].customer_alarm_warranty,
      },
      technician: {
        name: results[0]?.technician_name || "",
        contactNumber: results[0]?.technician_phone_number || "",
        eta: results[0]?.technician_eta || "",
      },
    };

    return res.status(200).json({ status: 200, result: orderDetails });
  });
}

function declineOrder(req, res) {
  const { type } = req.user;
  const { cancel_details } = req.body;
  if (type === "customer") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }

  const { id } = req.params;
  const declineOrderQuery = `UPDATE ordertable SET technician_id=NULL, order_status='cancelled', cancel_details='${cancel_details}' WHERE order_id='${id}'`;
  db.query(declineOrderQuery, (error) => {
    if (error) {
      console.error("Error assigning technician:", error);
      return res.status(500).json({ message: "Database error", status: 500 });
    }

    // Query for customer_id using the order_id
    const customerIdQuery = `SELECT customer_id FROM ordertable WHERE order_id=${id}`;

    db.query(customerIdQuery, (error, customerResult) => {
      if (error || !customerResult.length) {
        console.error("Error retrieving customer ID:", error);
        return res.status(500).json({ message: "Customer not found", status: 500 });
      }

      const customerId = customerResult[0].customer_id;

      // Query for FCM token using customer_id
      const tokenQuery = `SELECT fcm_token FROM customer WHERE customer_id=${customerId}`;

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
              title: "Request declined!",
              body: `Order: ${id} has been declined. Await for further confirmation...`
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
        return res.status(200).json({ message: "Order declined successfully", status: 200 });

      });
    });

  });
}

function assignTechnician(req, res) {
  const { type } = req.user;
  const { id } = req.params;
  const { technician_id } = req.body;

  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }

  const assignTechnicianQuery = `UPDATE ordertable SET order_status='ongoing', technician_id=${technician_id} WHERE order_id=${id}`;

  db.query(assignTechnicianQuery, (error) => {
    if (error) {
      console.error("Error assigning technician:", error);
      return res.status(500).json({ message: "Database error", status: 500 });
    }

    // Query for customer_id using the order_id
    const customerIdQuery = `SELECT customer_id FROM ordertable WHERE order_id=${id}`;

    db.query(customerIdQuery, (error, customerResult) => {
      if (error || !customerResult.length) {
        console.error("Error retrieving customer ID:", error);
        return res.status(500).json({ message: "Customer not found", status: 500 });
      }

      const customerId = customerResult[0].customer_id;

      // Query for FCM token using customer_id
      const tokenQuery = `SELECT fcm_token FROM customer WHERE customer_id=${customerId}`;

      db.query(tokenQuery, (error, tokenResult) => {
        if (error || !tokenResult.length) {
          console.error("Error retrieving FCM token:", error);
          return res.status(500).json({ message: "Token not found", status: 500 });
        }

        const registrationToken = tokenResult[0].fcm_token;

        // Query for technician's name using technician_id
        const technicianNameQuery = `SELECT name FROM technician WHERE technician_id=${technician_id}`;

        db.query(technicianNameQuery, (error, technicianResult) => {
          if (error || !technicianResult.length) {
            console.error("Error retrieving technician name:", error);
            return res.status(500).json({ message: "Technician not found", status: 500 });
          }

          const technicianName = technicianResult[0].name;

          const orderDateQuery = `SELECT order_date FROM ordertable WHERE order_id=${id}`;

          db.query(orderDateQuery, (error, orderDateResult) => {
            if (error || !orderDateResult.length) {
              console.error("Error retrieving order date:", error);
              return res.status(500).json({ message: "Order date not found", status: 500 });
            }

            const unFormattedEta =  orderDateResult[0].order_date;

            const eta = unFormattedEta.toISOString().split('T')[0];

            const orderTimeQuery = `SELECT order_time FROM ordertable WHERE order_id=${id}`;

            db.query(orderTimeQuery, (error, orderTimeResult) => {
              if (error || !orderTimeResult.length) {
                console.error("Error retrieving order time:", error);
                return res.status(500).json({ message: "Order time not found", status: 500 });
              }

              const arrivalTimeStart = orderTimeResult[0].order_time;

              // Parse the time into a Date object
              let [hours, minutes, seconds] = arrivalTimeStart.split(':').map(Number);
              let date = new Date();
              date.setHours(hours, minutes, seconds);

              // Add one hour
              date.setHours(date.getHours() + 1);

              const summary = technicianName;
              const description = `Order: ${id}`;
              
              const arrivalTimeEnd = date.toTimeString().split(' ')[0];
              const orderId = id;

              console.log("eta: ", eta);
              console.log("summary: ", summary);
              console.log("description: ", description);
              console.log("arrivalTimeEnd: ", arrivalTimeStart);
              console.log("arrivalTimeEnd: ", arrivalTimeEnd);
              console.log("orderId: ", orderId);

              const data = {
                eta,
                summary,
                description,
                arrivalTimeStart,
                arrivalTimeEnd,
                orderId
              };

              try {
                const response = fetch('http://68.183.182.216:5005/submit-eta', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
        
                const result = response.text();
                alert(result);
              } catch (error) {
                  console.error('Error:', error);
              }

              // Send FCM notification
              const sendNotification = async (registrationToken) => {
                const messageSend = {
                  token: registrationToken,
                  notification: {
                    title: "Request Accepted!",
                    body: `Technician: ${technicianName} has been assigned to your task`
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
              return res.status(200).json({ message: "Order assigned successfully", status: 200 });
            });
          });
        });
      });
    });
  });
}
function acceptOrder(req, res) {
  const { type, userId } = req.user;
  const { id } = req.params;
  const { eta, total_amount } = req.body;

  if (type !== "technician") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }
  const technician_eta = eta.split("T")[0];

  const acceptOrderQuery = `UPDATE ordertable SET order_status='ongoing', accept='1', technician_id=${userId}, technician_eta='${technician_eta}', total_price=${total_amount} WHERE order_id=${id}`;
  db.query(acceptOrderQuery, (error) => {
    if (error) {
      console.error("Error accepting order:", error);
      return res.status(500).json({ message: "Database error", status: 500 });
    }

    // Query for customer_id using the order_id
    const customerIdQuery = `SELECT customer_id FROM ordertable WHERE order_id=${id}`;

    db.query(customerIdQuery, (error, customerResult) => {
      if (error || !customerResult.length) {
        console.error("Error retrieving customer ID:", error);
        return res.status(500).json({ message: "Customer not found", status: 500 });
      }

      const customerId = customerResult[0].customer_id;

      // Query for FCM token using customer_id
      const tokenQuery = `SELECT fcm_token FROM customer WHERE customer_id=${customerId}`;

      db.query(tokenQuery, (error, tokenResult) => {
        if (error || !tokenResult.length) {
          console.error("Error retrieving FCM token:", error);
          return res.status(500).json({ message: "Token not found", status: 500 });
        }

        const registrationToken = tokenResult[0].fcm_token;

        // Query for technician's name using technician_id
        const technicianNameQuery = `SELECT name FROM technician WHERE technician_id=${userId}`;

        db.query(technicianNameQuery, (error, technicianResult) => {
          if (error || !technicianResult.length) {
            console.error("Error retrieving technician name:", error);
            return res.status(500).json({ message: "Technician not found", status: 500 });
          }

          const technicianName = technicianResult[0].name;

          const orderDateQuery = `SELECT order_date FROM ordertable WHERE order_id=${id}`;

          db.query(orderDateQuery, (error, orderDateResult) => {
            if (error || !orderDateResult.length) {
              console.error("Error retrieving order date:", error);
              return res.status(500).json({ message: "Order date not found", status: 500 });
            }

            const unFormattedEta =  orderDateResult[0].order_date;

            const eta = unFormattedEta.toISOString().split('T')[0];

            const orderTimeQuery = `SELECT order_time FROM ordertable WHERE order_id=${id}`;

            db.query(orderTimeQuery, (error, orderTimeResult) => {
              if (error || !orderTimeResult.length) {
                console.error("Error retrieving order time:", error);
                return res.status(500).json({ message: "Order time not found", status: 500 });
              }

              const arrivalTimeStart = orderTimeResult[0].order_time;

              // Parse the time into a Date object
              let [hours, minutes, seconds] = arrivalTimeStart.split(':').map(Number);
              let date = new Date();
              date.setHours(hours, minutes, seconds);

              // Add one hour
              date.setHours(date.getHours() + 1);

              const summary = technicianName;
              const description = `Order: ${id}`;
              
              const arrivalTimeEnd = date.toTimeString().split(' ')[0];
              const orderId = id;

              console.log("eta: ", eta);
              console.log("summary: ", summary);
              console.log("description: ", description);
              console.log("arrivalTimeEnd: ", arrivalTimeStart);
              console.log("arrivalTimeEnd: ", arrivalTimeEnd);
              console.log("orderId: ", orderId);

              const data = {
                eta,
                summary,
                description,
                arrivalTimeStart,
                arrivalTimeEnd,
                orderId
              };

              try {
                const response = fetch('http://68.183.182.216:5005/submit-eta', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
        
                const result = response.text();
                alert(result);
              } catch (error) {
                  console.error('Error:', error);
              }

              // Send FCM notification
              const sendNotification = async (registrationToken) => {
                const messageSend = {
                  token: registrationToken,
                  notification: {
                    title: "Request Accepted!",
                    body: `Technician: ${technicianName} has accepted your request.`
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
              return res.status(200).json({ message: "Accepted order successfully", status: 200 });
            });
          });
        });
      });
    });
  });
}

function invoiceOrder(req, res) {
  const orderId = req.params.id;

  const invoiceQuery = `
  SELECT 
      o.order_id,
      o.order_date,
      o.order_status,
      o.total_price,
      o.problem_type,
      o.order_done_date,
      o.rating,
      o.review_text,
      o.review_date,
      o.technician_start_time,
      o.technician_stop_time,
      c.name AS customer_name,
      c.location AS customer_address,
      c.email AS customer_email,
      c.phone_number AS customer_phone_number,
      t.name AS technician_name,
      t.location AS technician_location,
      t.email AS technician_email,
      r.parts_needed AS requested_spare_part,
      p.total_hours AS working_time,
      p.spare_part_cost AS spare_cost,
      p.hourly_rate AS hour_rate,
      p.total_amount AS total
    FROM 
      ordertable o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN technician t ON o.technician_id = t.technician_id
      LEFT JOIN request_forms r ON o.id = r.id
      LEFT JOIN payments p ON o.payment_id = p.payment_id
    WHERE 
      o.order_id = ${orderId} AND
      o.order_status = 'completed'
  `;
  db.query(invoiceQuery, (error, results) => {
    if (error) {
      console.error("Error executing database query:", error);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    return res.status(200).json({ status: 200, result: results[0] });
  });
}

function markOrderCompleted(req, res) {
  const orderId = req.params.id;
  const technicianId = req.params.technicianId; // Ensure technicianId is passed correctly

  const updateOrderQuery = `UPDATE ordertable SET order_status = 'completed' WHERE order_id = ${orderId}`;

  // Query to update the technician status to 'free'
  const updateTechniciansQuery = `
   UPDATE technician SET status = 'free' WHERE technician_id = ${technicianId}`;

  const requestIdQuery = `SELECT id FROM request_forms WHERE order_id=${orderId}`;

  const paymentIdQuery = `SELECT payment_id FROM payments WHERE order_id=${orderId}`;
  // Update the order status
  db.query(updateOrderQuery, (error, results) => {
    if (error) {
      console.error("Error executing database query for orders:", error);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    console.log(`Order update affected rows: ${results.affectedRows}`);
    if (results.affectedRows === 0) {
      console.warn("No rows updated in ordertable. Order might not exist.");
    }

    // Update the technician status
    db.query(updateTechniciansQuery, (error, results) => {
      if (error) {
        console.error("Error updating technician status:", error);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      console.log(`Technician update affected rows: ${results.affectedRows}`);
      if (results.affectedRows === 0) {
        console.warn("No rows updated in technician table. Technician might not exist or is already free.");
      }

      db.query(requestIdQuery, (error, requestResult) => {
        let requestId = null; // Default value if no request ID is found

        if (error) {
          console.error("Error retrieving request ID:", error);
          // Optionally log the error and move on
        } else if (requestResult.length) {
          requestId = requestResult[0].id; // Use the retrieved request ID if available
        }

        db.query(paymentIdQuery, (error, paymentResult) => {
          let paymentId = null; // Default value if no payment ID is found

          if (error) {
            console.error("Error retrieving payment ID:", error);
            // Optionally log the error and move on
          } else if (paymentResult.length) {
            paymentId = paymentResult[0].payment_id; // Use the retrieved payment ID if available
          }

          const updateQuery = `UPDATE ordertable SET id = ${requestId ? `'${requestId}'` : 'NULL'}, payment_id = ${paymentId ? `'${paymentId}'` : 'NULL'} WHERE order_id = ${orderId}`;

          db.query(updateQuery, (error, results) => {
            if (error) {
              console.error("Error executing database query:", error);
              return res.status(500).json({ error: "Internal Server Error" });
            }
            return res.status(200).json({ success: 'success' });
          });
        });
      });


    });
  });
}


function getCompletedPicture(req, res) {
  const orderId = req.params.id;

  // Check if file is uploaded
  console.log('File:', req.file);

  const order_img = req.file ? `uploads/${req.file.filename}` : null;
  const now = new Date();
  const order_date = now.toISOString().slice(0, 10).split("T")[0];
  const order_time = now.toTimeString().slice(0, 8);

  console.log('Order Image:', order_img);

  const updateOrderQuery = `UPDATE ordertable SET order_done_img = '${order_img}', technician_stop_time = '${order_time}', order_done_date = '${order_date}' WHERE order_id = ${orderId}`;

  // Execute query with parameterized values
  db.query(updateOrderQuery, (error, results) => {
    if (error) {
      console.error("Error executing database query:", error);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.status(200).json({ message: "success" });
  });
}


// Function to get an order by its ID // new_addition 
function getOrderById(req, res) {
  const orderId = req.params.id;

  // Query to fetch the order by ID
  const getOrderQuery = `SELECT * FROM ordertable WHERE order_id = ${orderId}`;

  db.query(getOrderQuery, (error, results) => {
    if (error) {
      console.error("Error executing database query:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Return the order details
    return res.status(200).json({ status: 200, result: results[0] });
  });
}

function createReview(req, res) {
  const orderId = req.params.id;
  const {
    rating,
    reviewText,

  } = req.body;

  const { type } = req.user;

  if (type === "technician") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }

  const now = new Date();
  const review_date = now.toISOString().slice(0, 10).split("T")[0];

  let createReviewQuery = `UPDATE ordertable SET rating = '${rating}', review_text = '${reviewText}'`;
  createReviewQuery = review_date
    ? `${createReviewQuery}, review_date = '${review_date}'`
    : createReviewQuery;


  createReviewQuery = `${createReviewQuery} WHERE order_id = ${orderId}`;
  db.query(createReviewQuery, (error, result) => {
    if (error) {
      throw error;
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    return res
      .status(200)
      .json({ message: "Review updated successfully", status: 200 });
  });

}

function getOrdersCountByStatus(status) {
  return `SELECT COUNT(*) AS orders_count FROM ordertable WHERE order_status = "${status}"`;
}
function pendingOrdersCount(req, res) {
  const countQuery = getOrdersCountByStatus("pending");
  db.query(countQuery, (error, results) => {
    if (error) {
      console.error("Error counting pending orders:", error);
      res.status(500).json({ error: "Internal server error", status: 500 });
      return;
    }
    res.json({ count: results[0].orders_count, status: 200 });
  });
}

function completedOrdersCount(req, res) {
  const countQuery = getOrdersCountByStatus("completed");
  db.query(countQuery, (error, results) => {
    if (error) {
      console.error("Error counting completed orders:", error);
      res.status(500).json({ error: "Internal server error", status: 500 });
      return;
    }
    res.json({ count: results[0].orders_count, status: 200 });
  });
}

function ongoingOrdersCount(req, res) {
  const countQuery = getOrdersCountByStatus("ongoing");
  db.query(countQuery, (error, results) => {
    if (error) {
      console.error("Error counting ongoing orders:", error);
      res.status(500).json({ error: "Internal server error", status: 500 });
      return;
    }
    res.json({ count: results[0].orders_count, status: 200 });
  });
}

function pendingOrdersQuery() {
  return `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.location AS customer_location
  FROM ordertable o
  JOIN customer c ON o.customer_id = c.customer_id`;
}

function viewAllOrders(req, res) {
  const { status } = req.query;
  const { userId, type } = req.user;
  let viewAllOrdersQuery = "";

  if (type === "customer") {
    // Select orders associated with the customer and join customer information
    viewAllOrdersQuery = `
      SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.location AS customer_location
      FROM ordertable o
      JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.customer_id = ${userId}
    `;
  } else if (type === "technician") {
    // Select orders associated with the technician and join technician information
    viewAllOrdersQuery = `
      SELECT o.*, t.name AS technician_name,  t.email AS technician_email, t.location AS technician_location
      FROM ordertable o
      JOIN technician t ON o.technician_id = t.technician_id
      WHERE o.technician_id = ${userId}
    `;
  } else {
    // For admin users, retrieve all orders with optional status filter
    viewAllOrdersQuery = `
      SELECT o.*, c.name AS customer_name,
      c.location AS customer_address,
      c.email AS customer_email,
      c.location AS customer_location,
      t.name AS technician_name,
      t.email AS technician_email,
      t.specialization AS technician_specialization
      FROM ordertable o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN technician t ON o.technician_id = t.technician_id
    `;
  }
  if (status === "pending" && type === "admin") {
    viewAllOrdersQuery = pendingOrdersQuery();
  }
  // Append status filter if provided and user is admin or technician
  if (status && type === "admin") {
    viewAllOrdersQuery += ` WHERE o.order_status = '${status}'`;
  } else if (status) {
    viewAllOrdersQuery += ` AND o.order_status = '${status}'`;
  }

  // Execute the SQL query
  db.query(viewAllOrdersQuery, (error, rows) => {
    if (error) {
      throw error;
    }
    return res.status(200).json({ result: rows, status: 200 });
  });
}

// new_addition 
function viewCancelledOrderHistory(req, res) {
  const { type } = req.user;

  // Check if the user is an admin
  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Query to fetch all cancelled orders
  const cancelledOrderQuery = `
    SELECT * 
    FROM ordertable
    WHERE order_status = 'cancelled'
  `;

  // Execute the query
  db.query(cancelledOrderQuery, (error, rows) => {
    if (error) {
      return res.status(500).json({ message: "Database query error", error });
    }

    // Return the cancelled order history
    return res.status(200).json({ result: rows, status: 200 });
  });
};

function getOrderCountsByDate(req, res) {
  const orderCountsQuery = `
    SELECT 
      order_date,
      order_status, 
      COUNT(*) as count 
    FROM ordertable 
    GROUP BY order_date, order_status
    ORDER BY order_date
  `;

  db.query(orderCountsQuery, (error, results) => {
    if (error) {
      console.error("Error fetching order counts by date:", error);
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    // Organize results by date
    const dataByDate = {};
    results.forEach(row => {
      const { order_date, order_status, count } = row;
      if (!dataByDate[order_date]) {
        dataByDate[order_date] = { completed: 0, ongoing: 0, cancelled: 0 };
      }
      dataByDate[order_date][order_status] = count;
    });

    res.json({ dataByDate, status: 200 });
  });
}



function viewCompletedOrderHistory(req, res) {
  let { technician, date } = req.query;
  const { type } = req.user;

  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let completedOrderQuery =
    "SELECT o.*, t.name AS technician_name FROM ordertable o INNER JOIN technician t ON o.technician_id = t.technician_id";

  if (technician && date) {
    completedOrderQuery += ` WHERE t.name LIKE '%${technician}%' AND DATE(o.order_done_date) = '${date}'`;
  } else if (technician) {
    completedOrderQuery += ` WHERE t.name LIKE '%${technician}%'`;
  } else if (date) {
    completedOrderQuery += ` WHERE DATE(o.order_done_date) = '${date}'`;
  }

  completedOrderQuery += ` AND o.order_status='completed'`;

  db.query(completedOrderQuery, (error, rows) => {
    if (error) {
      throw error;
    }
    return res.status(200).json({ result: rows, status: 200 });
  });
}








function viewProblemStatistics(req, res) {
  const { type } = req.user;

  // Check if the user is an admin
  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // SQL query to count problem types grouped by month
  const problemStatsQuery = `
      SELECT 
          DATE_FORMAT(order_date, '%Y-%m') AS month, 
          problem_type, 
          COUNT(*) AS problem_count
      FROM 
          ordertable
      WHERE 
          problem_type IN ('alarm', 'autogate')  -- Filter for specific problem types
      GROUP BY 
          DATE_FORMAT(order_date, '%Y-%m'), 
          problem_type
      ORDER BY 
          month ASC;
  `;

  // Execute the query
  db.query(problemStatsQuery, (error, rows) => {
    if (error) {
      console.error("Error fetching problem statistics:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    // Format the data for Google Charts
    const formattedData = [['Month', 'Alarm', 'Autogate']];
    const monthMap = new Map();

    rows.forEach(row => {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, { alarm: 0, autogate: 0 });
      }
      if (row.problem_type === 'alarm') {
        monthMap.get(row.month).alarm = row.problem_count;
      } else if (row.problem_type === 'autogate') {
        monthMap.get(row.month).autogate = row.problem_count;
      }
    });

    // Convert the Map into an array suitable for Google Charts
    monthMap.forEach((value, key) => {
      formattedData.push([key, value.alarm, value.autogate]);
    });

    // Return the formatted data
    res.json(formattedData);
  });
}


function viewOrderStatusStatistics(req, res) {
  const { type } = req.user;

  // Check if the user is an admin
  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // SQL query to count order statuses grouped by month
  const orderStatusQuery = `
      SELECT 
          DATE_FORMAT(order_date, '%Y-%m') AS month, 
          order_status, 
          COUNT(*) AS order_count
      FROM 
          ordertable
      WHERE 
          order_status IN ('ongoing', 'completed', 'cancelled')
      GROUP BY 
          month, order_status
      ORDER BY 
          month ASC;
  `;

  // Execute the query
  db.query(orderStatusQuery, (error, rows) => {
    if (error) {
      console.error("Error fetching order status statistics:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    // Format the data for Google Charts
    const formattedData = [['Month', 'Ongoing', 'Completed', 'Cancelled']];
    const monthMap = new Map();

    rows.forEach(row => {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, { ongoing: 0, completed: 0, cancelled: 0 });
      }
      if (row.order_status === 'ongoing') {
        monthMap.get(row.month).ongoing = row.order_count;
      } else if (row.order_status === 'completed') {
        monthMap.get(row.month).completed = row.order_count;
      } else if (row.order_status === 'cancelled') {
        monthMap.get(row.month).cancelled = row.order_count;
      }
    });

    // Convert the Map into an array suitable for Google Charts
    monthMap.forEach((value, key) => {
      formattedData.push([key, value.ongoing, value.completed, value.cancelled]);
    });

    // Return the formatted data
    res.json(formattedData);
  });
}





function viewCompletedOrderSales(req, res) {
  const { type } = req.user;

  // Check if the user is an admin
  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // SQL query to get completed order counts and total price grouped by month
  const completedOrderSalesQuery = `
      SELECT 
          DATE_FORMAT(order_date, '%Y-%m') AS month, 
          COUNT(*) AS order_count,
          SUM(total_price) AS total_price
      FROM 
          ordertable
      WHERE 
          order_status = 'completed'
      GROUP BY 
          month
      ORDER BY 
          month ASC;
  `;

  // Execute the query
  db.query(completedOrderSalesQuery, (error, rows) => {
    if (error) {
      console.error("Error fetching completed order sales data:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    // Format the data for the chart
    const formattedData = [['Month', 'Order Count', 'Total Price']];
    rows.forEach(row => {
      formattedData.push([row.month, row.order_count, row.total_price]);
    });

    // Return the formatted data
    res.json(formattedData);
  });
}


function viewTopSpareParts(req, res) {
  const { type } = req.user;

  // Check if the user is an admin
  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // SQL query to get the top 3 most occurring spare parts
  const topSparePartsQuery = `
     SELECT 
        parts_needed, 
        COUNT(parts_needed) AS occurrences 
    FROM 
        request_forms
    GROUP BY 
        parts_needed
    ORDER BY 
        occurrences DESC
    LIMIT 3;
  `;

  // Execute the query
  db.query(topSparePartsQuery, (error, rows) => {
    if (error) {
      console.error("Error fetching top spare parts:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    // Return the result
    res.status(200).json({ result: rows, status: 200 });
  });
}



function viewOrdersDetail(req, res) {
  const orderId = req.params.id;

  const dbQuery = `
    SELECT 
      ordertable.*,
      c.name AS customer_name,
      c.location AS customer_address,
      c.phone_number AS customer_phone_number,
      c.email as customer_email,
      c.auto_gate_brand as customer_auto_gate_brand,
      c.alarm_brand as customer_alarm_brand,
      c.auto_gate_warranty as customer_auto_gate_warranty,
      c.alarm_warranty as customer_alarm_warranty
      
    FROM 
      ordertable
    JOIN 
      customer c ON ordertable.customer_id = c.customer_id
    LEFT JOIN
      technician t ON ordertable.technician_id = t.technician_id
    WHERE 
      ordertable.order_id = ${orderId}
  `;

  db.query(dbQuery, (error, results) => {
    if (error) {
      console.error("Error executing database query:", error);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Order not found", status: 404 });
    }

    const orderDetails = {
      orderId: results[0].order_id,
      orderDate: results[0].order_date,
      orderDoneDate: results[0].order_done_date,
      orderStatus: results[0].order_status,
      orderTime: results[0].order_time,
      orderImage: results[0].order_img,
      orderDoneImage: results[0].order_done_img,
      orderDetail: results[0].order_detail,
      priority: results[0].urgency_level,
      locationDetail: results[0].location_details,
      priceStatus: results[0].price_status,
      totalPrice: results[0].total_price,
      ProblemType: results[0].problem_type,
      CustomerID: results[0].customer_id,
      TechnicianID: results[0].technician_id,
      TechnicianETA: results[0].technician_eta,
      customer: {
        name: results[0].customer_name,
        address: results[0].customer_address,
        email: results[0].customer_email,
        phone: results[0].customer_phone_number,
        autogateBrand: results[0].customer_auto_gate_brand,
        alarmBrand: results[0].customer_alarm_brand,
        autogateWarranty: results[0].customer_auto_gate_warranty,
        alarmWarranty: results[0].customer_alarm_warranty,
      },
    };

    return res.status(200).json({ status: 200, result: orderDetails });
  });
}

function getPendingOrders(req, res) {
  const pendingOrdersQuery = `
    SELECT
      o.*,
      c.name AS customer_name,
      c.email AS customer_email,
      c.location AS customer_location
    FROM
      ordertable o
    LEFT JOIN customer c ON
      o.customer_id = c.customer_id
    WHERE
      o.order_status = 'pending';
  `;

  // Execute the query
  db.query(pendingOrdersQuery, (error, rows) => {
    if (error) {
      console.error("Error retrieving pending orders:", error);
      return res.status(500).json({ message: "Internal Server Error", status: 500 });
    }

    // Return all pending orders
    return res.status(200).json({ result: rows, status: 200 });
  });
}

function cancelOrder(req, res) {
  const { type } = req.user;

  if (type !== "customer") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }

  const { id } = req.params;

  // Check if the order was created within the last 2 hours
  const timeCheckQuery = `
    SELECT created_at 
    FROM ordertable 
    WHERE order_id = ${id}`; // Manual interpolation for order_id

  db.query(timeCheckQuery, (error, result) => {
    if (error || !result.length) {
      console.error("Error checking order creation time:", error);
      return res.status(404).json({ message: "Order not found", status: 404 });
    }

    const createdAt = new Date(result[0].created_at);
    const currentTime = new Date();

    // Check if the time difference exceeds 2 hours
    const timeDifference = (currentTime - createdAt) / (1000 * 60 * 60);

    if (timeDifference > 2) {
      return res
        .status(400)
        .json({ message: "Cancellation period has expired.", status: 400 });
    }

    // Proceed with the existing cancellation logic
    const declineOrderQuery = `
      UPDATE ordertable 
      SET technician_id = NULL, order_status = 'cancelled' 
      WHERE order_id = ${id}`; // Manual interpolation for order_id

    db.query(declineOrderQuery, (error) => {
      if (error) {
        console.error("Error cancelling request:", error);
        return res.status(500).json({ message: "Database error", status: 500 });
      }

      // Query for customer_id using the order_id
      const customerIdQuery = `SELECT customer_id FROM ordertable WHERE order_id = ${id}`; // Manual interpolation

      db.query(customerIdQuery, async (error, customerResult) => {
        if (error || !customerResult.length) {
          console.error("Error retrieving customer ID:", error);
          return res
            .status(404)
            .json({ message: "Customer not found", status: 404 });
        }

        const customerId = customerResult[0].customer_id;

        // Query for FCM token using customer_id
        const tokenQuery = `SELECT fcm_token FROM customer WHERE customer_id = ${customerId}`; // Manual interpolation

        db.query(tokenQuery, async (error, tokenResult) => {
          if (error || !tokenResult.length) {
            console.error("Error retrieving FCM token:", error);
            return res
              .status(404)
              .json({ message: "Token not found", status: 404 });
          }

          const registrationToken = tokenResult[0].fcm_token;

          // Send FCM notification
          const messageSend = {
            token: registrationToken,
            notification: {
              title: "Request Cancelled!",
              body: `Order: ${id} has been cancelled.`,
            },
            data: {
              key1: "value1",
              key2: "value2",
            },
            android: {
              priority: "high",
            },
            apns: {
              payload: {
                aps: {
                  badge: 42,
                },
              },
            },
          };

          try {
            const response = await admin.messaging().send(messageSend);
            console.log("Successfully sent message:", response);
            return res
              .status(200)
              .json({ message: "Order cancelled successfully", status: 200 });
          } catch (error) {
            console.error("Error sending message:", error);
            return res
              .status(500)
              .json({ message: "Notification error", status: 500 });
          }
        });
      });
    });
  });
}



const viewReview = (req, res) => {
  const { type } = req.user;

  // Check if the user is an admin
  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // SQL query to select reviews from completed orders
  const viewReviewQuery = `
      SELECT o.order_id, t.name AS technician_name, o.rating, o.review_text, o.review_date, o.location_details AS address
      FROM ordertable o
      JOIN technician t ON o.technician_id = t.technician_id
      WHERE o.rating IS NOT NULL 
        AND o.review_text IS NOT NULL 
        AND o.order_status = 'completed'
  `;

  // Execute the query
  db.query(viewReviewQuery, (error, reviews) => {
    if (error) {
      console.error("Error fetching reviews:", error);
      return res.status(500).json({ message: "Failed to fetch reviews", status: 500 });
    }

    // Return the fetched reviews in the response
    return res.status(200).json(reviews);
  });
}



const calculatePayment = (req, res) => {
  const { orderId, technicianId } = req.body;

  // Validate inputs
  if (!orderId || isNaN(orderId) || !technicianId) {
    return res.status(400).json({ message: 'Invalid or missing input parameter.' });
  }

  // Fixed hourly rate
  const hourlyRate = 20;

  // Step 1: Fetch order details
  const orderQuery = `
    SELECT order_date, order_done_date, technician_start_time, technician_stop_time
    FROM ordertable
    WHERE order_id = ${orderId};
  `;

  db.query(orderQuery, (err, orderResult) => {
    if (err) {
      console.error('Error fetching order details:', err);
      return res.status(500).json({ message: 'Server error fetching order details' });
    }

    if (orderResult.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const { order_date, order_done_date, technician_start_time, technician_stop_time } = orderResult[0];

    console.log('Order Details:', { order_date, order_done_date, technician_start_time, technician_stop_time });

    if (!technician_start_time || !technician_stop_time) {
      return res.status(400).json({ message: 'Technician start or stop time is missing.' });
    }

    // Fix parsing of date and time
    const formattedOrderDate = order_date.toISOString().split('T')[0]; // Extract date in YYYY-MM-DD format
    const formattedDoneDate = order_done_date.toISOString().split('T')[0]; // Extract date in YYYY-MM-DD format

    const startTime = new Date(`${formattedOrderDate}T${technician_start_time}`);
    const stopTime = new Date(`${formattedDoneDate}T${technician_stop_time}`);

    console.log('Start Time:', startTime);
    console.log('Stop Time:', stopTime);

    if (isNaN(startTime.getTime()) || isNaN(stopTime.getTime())) {
      console.error('Invalid Start or Stop Time:', { startTime, stopTime });
      return res.status(400).json({ message: 'Error parsing start or stop time.' });
    }

    if (stopTime < startTime) {
      console.error('Stop Time is before Start Time:', { startTime, stopTime });
      return res.status(400).json({ message: 'Technician Stop Time cannot be before Start Time.' });
    }

    const totalMinutes = (stopTime - startTime) / (1000 * 60); // Convert to minutes
    let totalHours = Math.max(totalMinutes / 60, 0); // Ensure non-negative value

    console.log('Total Minutes:', totalMinutes);
    console.log('Total Hours (Initial):', totalHours);

    // Step 2: Fetch spare part wait times and calculate spare part cost
    const sparePartsQuery = `
      SELECT rf.created_at, rf.arrival_time, rf.parts_needed
      FROM request_forms rf
      WHERE rf.order_id = ${orderId};
    `;

    db.query(sparePartsQuery, async (err, partsResult) => {
      if (err) {
        console.error('Error fetching spare parts details:', err);
        return res.status(500).json({ message: 'Server error fetching spare parts details' });
      }

      let totalSparePartCost = 0;
      let totalWaitMinutes = 0;

      try {
        const pricePromises = partsResult.map(async (partRow) => {
          const { created_at, arrival_time, parts_needed } = partRow;

          console.log('Spare Part Row:', { created_at, arrival_time, parts_needed });

          // Calculate wait time
          if (created_at && arrival_time) {
            const requestTime = new Date(created_at);
            const arrivalTime = new Date(arrival_time);

            if (!isNaN(requestTime.getTime()) && !isNaN(arrivalTime.getTime())) {
              const waitMinutes = (arrivalTime - requestTime) / (1000 * 60);
              totalWaitMinutes += Math.max(waitMinutes, 0);
            }
          }

          // Calculate spare part costs
          if (parts_needed) {
            const partsArray = parts_needed.split(',').map((part) => part.trim());
            const priceQuery = `
              SELECT name, price
              FROM inventory
              WHERE name IN (${partsArray.map((part) => `'${part}'`).join(',')});
            `;

            const priceResult = await new Promise((resolve, reject) => {
              db.query(priceQuery, (err, result) => {
                if (err) return reject(err);
                resolve(result);
              });
            });

            console.log('Price Result:', priceResult);

            priceResult.forEach((priceRow) => {
              totalSparePartCost += parseFloat(priceRow.price || 0);
            });
          }
        });

        await Promise.all(pricePromises);

        const waitHours = totalWaitMinutes / 60;

        console.log('Total Wait Minutes:', totalWaitMinutes);
        console.log('Wait Hours:', waitHours);
        console.log('Total Spare Part Cost:', totalSparePartCost);

        // Step 3: Adjust total hours and calculate total amount
        totalHours = Math.max(totalHours - waitHours, 0); // Ensure non-negative value
        const totalAmount = totalHours * hourlyRate + totalSparePartCost;

        console.log('Adjusted Total Hours:', totalHours);
        console.log('Total Amount:', totalAmount);

        // Step 4: Insert or update payment details
        const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const paymentQuery = `
          INSERT INTO payments (
            order_id, technician_id, total_hours, spare_part_wait_time,
            spare_part_cost, hourly_rate, total_amount, payment_status, created_at
          )
          VALUES (
            ${orderId}, 
            ${technicianId}, 
            ${totalHours}, 
            ${waitHours}, 
            ${totalSparePartCost}, 
            ${hourlyRate}, 
            ${totalAmount}, 
            'Pending', 
            '${createdAt}'
          )
          ON DUPLICATE KEY UPDATE
            technician_id = VALUES(technician_id),
            total_hours = VALUES(total_hours),
            spare_part_cost = VALUES(spare_part_cost),
            hourly_rate = VALUES(hourly_rate),
            total_amount = VALUES(total_amount),
            payment_status = VALUES(payment_status),
            created_at = VALUES(created_at);
        `;

        db.query(paymentQuery, (err, result) => {
          if (err) {
            console.error('Error calculating payment:', err);
            return res.status(500).json({ message: 'Server error calculating payment' });
          }


          res.status(200).json({
            message: 'Payment calculated successfully',
            totalAmount,
            totalHours,
            totalSparePartCost,
            waitHours,
          });
        });
      } catch (e) {
        console.error('Error processing spare parts:', e);
        return res.status(500).json({ message: 'Error processing spare parts.' });
      }
    });
  });
};

const completePayment = (req, res) => {
  const { orderId, paymentMethod } = req.body;

  console.log("Received request for completePayment:", { orderId, paymentMethod });

  // Validate inputs
  if (!orderId || isNaN(orderId) || !paymentMethod) {
    console.error("Invalid or missing input parameter:", { orderId, paymentMethod });
    return res.status(400).json({ message: 'Invalid or missing input parameter.' });
  }

  // Step 1: Fetch totalAmount from payments table
  const fetchTotalAmountQuery = `
    SELECT total_amount
    FROM payments
    WHERE order_id = ${orderId};
  `;

  console.log("Executing fetchTotalAmountQuery:", fetchTotalAmountQuery);

  db.query(fetchTotalAmountQuery, (err, result) => {
    if (err) {
      console.error('Error fetching total amount from payments table:', err);
      return res.status(500).json({ message: 'Server error fetching total amount.' });
    }

    if (result.length === 0) {
      console.warn(`No entry found in payments table for order_id: ${orderId}`);
      return res.status(404).json({ message: 'Order not found in payments table.' });
    }

    const totalAmount = result[0].total_amount;
    console.log(`Fetched totalAmount for order_id ${orderId}:`, totalAmount);

    // Step 2: Update ordertable with totalAmount and payment details
    const updateOrderQuery = `
      UPDATE ordertable
      SET 
        total_price = ${totalAmount},
        price_details = '${paymentMethod}',
        price_status = 'Paid'
      WHERE order_id = ${orderId};
    `;

    console.log("Executing updateOrderQuery:", updateOrderQuery);

    db.query(updateOrderQuery, (updateErr) => {
      if (updateErr) {
        console.error('Error updating ordertable:', updateErr);
        return res.status(500).json({ message: 'Error updating order details.' });
      }

      console.log(`Order ${orderId} updated successfully with paymentMethod: ${paymentMethod} and totalAmount: ${totalAmount}`);
      res.status(200).json({
        message: 'Payment completed successfully',
        orderId,
        totalAmount,
        paymentMethod,
      });
    });
  });
};









module.exports = {
  viewReview,
  viewTopSpareParts,
  viewOrderStatusStatistics,
  viewProblemStatistics,
  viewCompletedOrderSales,
  getOrderCountsByDate,
  createOrder,
  viewAllOrders,
  pendingOrdersCount,
  completedOrdersCount,
  ongoingOrdersCount,
  declineOrder,
  viewCompletedOrderHistory,
  viewCancelledOrderHistory,
  viewRequestDetail,
  assignTechnician,
  acceptOrder,
  getOrderDetail,
  invoiceOrder,
  markOrderCompleted,
  createReview,
  getOrderById,
  deleteOrder,
  viewOrdersDetail,
  getPendingOrders,
  cancelOrder,
  calculatePayment,
  getCompletedPicture,
  completePayment
};
