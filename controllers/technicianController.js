const db = require("../utils/database");
const bcrypt = require('bcryptjs');

function createTechnician(req, res) {
  const { type } = req.user;

  // Check if the user is an admin
  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { email, name, password, specialization, phone_number, location } = req.body;

  // Check if technician already exists
  const isTechnicianExist = `SELECT * FROM technician WHERE email="${email}"`;

  db.query(isTechnicianExist, async (error, rows) => {
    if (error) {
      return res.status(500).json({ status: 500, message: "Internal Server Error" });
    }

    // If the technician already exists
    if (rows.length > 0) {
      return res.status(400).json({ message: "Email already exists", status: 400 });
    }

    try {
      // Hash the password using bcryptjs
      const hashedPassword = await bcrypt.hash(password, 10); // Salt rounds = 10

      // Insert the new technician into the database with the hashed password
      const createTechnicianQuery = `INSERT INTO technician (email, name, password, specialization, status, phone_number, location)
            VALUES ('${email}', '${name}', '${hashedPassword}', '${specialization}', 'free', '${phone_number}', '${location}')`;

      db.query(createTechnicianQuery, (error, rows) => {
        if (error) {
          return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }

        return res.status(201).json({
          message: "Technician created successfully",
          result: rows[0],
          status: 201,
        });
      });

    } catch (err) {
      console.error("Error hashing the password:", err);
      return res.status(500).json({ status: 500, message: "Internal Server Error" });
    }
  });
}

async function changeTechnicianStatus(req, res) {
  const technicianId = req.params.id
  const { status } = req.body;

  const TechStatus = `UPDATE technician SET status = '${status}' WHERE technician_id = ${technicianId}`;

  // Execute the query
  db.query(TechStatus, [status, technicianId], async (error, result) => {
    if (error) {
      console.error('Error updating technician status:', error);
      return res.status(500).json({ status: 500, message: "Internal Server Error" });
    }

    // Check if any rows were updated
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 404, message: "Technician not found or no change in status" });
    }

    // Successful update
    return res.status(200).json({
      status: 200,
      message: "Technician status updated successfully",
    });
  });
}


function getAllTechnicians(req, res) {
  const { type } = req.user;
  const { status } = req.query;

  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }
  let dbQuery = `SELECT * FROM technician`;
  if (status === "free") {
    dbQuery += ` WHERE ongoing_order_id IS NULL`;
  }

  console.log('Generated Query: ', dbQuery);
  db.query(dbQuery, (error, rows) => {
    if (error) {
      console.error('Error executing query:', error);
      return res.status(500).json({ message: "Error fetching technicians", status: 500 });
    }
    return res.status(200).json({ result: rows, status: 200 });
  });

}

function getTechnicianById(req, res) {
  const { type } = req.user;
  const technicianId = req.params.id;

  if (type !== "admin" && type !== "technician" && type !== "customer") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }
  const query = `SELECT * FROM technician WHERE technician_id = ${technicianId}`;
  db.query(query, (error, technician) => {
    if (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Error fetching technician", status: 500 });
    }

    return res.status(200).json({ technician: technician, status: 200 });
  });
}

function changeTechnicianStatus(req, res) {
  const { technicianId, status, orderId } = req.body;

  if (!technicianId || !orderId || !status) {
    return res.status(400).json({
      success: false,
      message: 'Missing required parameters (technicianId, orderId, status).',
    });
  }

  // Update technician status in the technician table
  const updateStatusQuery = `
    UPDATE technician 
    SET status = '${status}'
    WHERE technician_id = '${technicianId}'
  `;

  db.query(updateStatusQuery, (error, result) => {
    if (error) {
      console.error('Error updating technician status:', error);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Check if technician status was updated
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    // If status is "working", update the technician_start_time in the ordertable
    if (status === 'working') {
      const updateTimeQuery = `
        UPDATE ordertable 
        SET technician_start_time = NOW()
        WHERE order_id = '${orderId}'
      `;

      db.query(updateTimeQuery, (error, result) => {
        if (error) {
          console.error('Error updating technician start time:', error);
          return res.status(500).json({ success: false, message: 'Database error' });
        }

        // Check if order was updated
        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Respond with success if both updates are successful
        return res.status(200).json({ success: true, message: 'Technician status updated successfully' });
      });
    } else {
      // Respond with success if only the status was updated
      return res.status(200).json({ success: true, message: 'Technician status updated successfully' });
    }
  });
}







function updateTechnician(req, res) {
  const { type } = req.user;
  const technicianId = req.params.id;
  const { name, specialization, phone_number, email, location } = req.body;

  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }

  const updateQuery = `UPDATE technician SET location = '${location}' , name ='${name}' , email = '${email}' , specialization = '${specialization}', phone_number = '${phone_number}' WHERE technician_id = ${technicianId}`;
  db.query(updateQuery, (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: "Error updating technician" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Technician not found" });
    }

    return res
      .status(200)
      .json({ message: "Technician updated successfully", status: 200 });
  });
}

function deleteTechnician(req, res) {
  const { type } = req.user;
  const technicianId = req.params.id;

  if (type !== "admin") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }

  const deleteQuery = `DELETE FROM technician WHERE technician_id = ${technicianId}`;
  db.query(deleteQuery, (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: "Error deleting technician" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Technician not found" });
    }

    return res
      .status(200)
      .json({ message: "Technician deleted successfully", status: 200 });
  });
}

function getTechnicianByToken(req, res) {
  const token = req.headers.authorization.split(" ")[1]; // Extract token from authorization header

  if (!token) {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }

  const getTechnicianQuery = `SELECT * FROM technician WHERE token = '${token}'`;
  db.query(getTechnicianQuery, (error, technician) => {
    if (error) {
      throw error;
    }

    if (technician.length === 0) {
      return res
        .status(404)
        .json({ message: "Technician not found", status: 404 });
    }

    return res.status(200).json({ status: 200, data: technician[0] });
  });
}

function updateFCMTokenTechnician(req, res) {

  const { technicianId, fcmToken } =
    req.body;
  // Update the database with the generated token
  const updateUserTokenQuery = `
    UPDATE technician SET fcm_token="${fcmToken}" WHERE technician_id ="${technicianId}"
  `;

  db.query(updateUserTokenQuery, (error) => {
    if (error) {
      return res.status(500).json({ status: 500, message: "Internal Server Error" });
    }

    // Respond with success message along with token
    return res.status(200).json({
      message: "Login successful",

      status: 200,
    });
  });
}

function sendLocation(req, res) {
  const { longitude, latitude } = req.body;
  const technicianId = req.params.id; // Access technicianId from the URL parameter

  // Basic validation
  if (!longitude || !latitude) {
    return res.status(400).json({ error: 'Longitude and latitude are required.' });
  }

  // Construct the SQL query without sanitization
  const updateLocationQuery = `
    UPDATE technician 
    SET latitude = ${latitude}, longitude = ${longitude} 
    WHERE technician_id = ${technicianId}
  `;

  // Execute the query
  db.query(updateLocationQuery, (error, result) => {
    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'An error occurred while saving the location.' });
    }

    // Check if a row was updated
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Technician not found.' });
    }

    // Success response
    return res.status(200).json({ message: 'Location saved successfully', data: result });
  });
}


function declineOrderForTechnician(req, res) {
  const { type } = req.user;
  const { cancel_details } = req.body;
  if (type === "customer") {
    return res.status(401).json({ message: "Unauthorized", status: 401 });
  }

  const { id } = req.params;
  const declineOrderQuery = `UPDATE ordertable SET technician_id=NULL, order_status='pending', cancel_details='${cancel_details}' WHERE order_id='${id}'`;
  db.query(declineOrderQuery, (error) => {
    if (error) {
      throw error;
    }
    return res
      .status(200)
      .json({ message: "Order declined successfully", status: 200 });
  });
}

function checkTechnicianAvailability(req, res) {
  // Get technicianId from the URL parameters and orderId from the query string
  const technicianId = req.params.id;  // Ensure it's 'id' based on your route
  const orderId = req.query.orderId;

  console.log('Received technicianId:', technicianId);
  console.log('Received orderId:', orderId);

  if (!technicianId || !orderId) {
    return res.status(400).json({ error: 'Missing technicianId or orderId' });
  }

  // Query to get order date and order time from the order_id
  const orderQuery = `
    SELECT order_date, order_time 
    FROM ordertable 
    WHERE order_id = ${orderId};
  `;

  // Perform the query to get the order details using db.query()
  db.query(orderQuery, (err, orderResults) => {
    if (err) {
      console.error('Error executing order query:', err);
      return res.status(500).json({ error: 'Database query error' });
    }

    if (orderResults.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { order_date, order_time } = orderResults[0];
    const newOrderTime = new Date(`${order_date}T${order_time}`);

    // Query to check technician's current status (working or not)
    const statusQuery = `
      SELECT status 
      FROM technician 
      WHERE technician_id = ${technicianId};
    `;

    // Check technician's status
    db.query(statusQuery, (err, statusResults) => {
      if (err) {
        console.error('Error executing technician status query:', err);
        return res.status(500).json({ error: 'Database query error' });
      }

      // If technician is working, return error
      if (statusResults.length > 0 && statusResults[0].status === 'working') {
        return res.status(400).json({ error: 'Technician is already working and cannot accept a new job.' });
      }

      // Query to check for overlapping jobs (only accepted or ongoing jobs)
      const overlapQuery = `
        SELECT order_id, order_date, order_time 
        FROM ordertable 
        WHERE technician_id = ${technicianId} 
        AND order_status IN ('accepted', 'ongoing')
        AND order_id != ${orderId};  
      `;

      // Check for overlapping jobs
      db.query(overlapQuery, (err, overlapResults) => {
        if (err) {
          console.error('Error executing overlap query:', err);
          return res.status(500).json({ error: 'Database query error' });
        }

        // Loop through each existing job and check for time overlap
        for (let job of overlapResults) {
          const existingOrderDate = job.order_date;
          const existingOrderTime = job.order_time;

          // Combine existing order date and time to create a Date object for the existing order
          const existingOrderTimeObj = new Date(`${existingOrderDate}T${existingOrderTime}`);

          // Check if the new order's time overlaps with any existing job
          if (newOrderTime.getTime() === existingOrderTimeObj.getTime()) {
            console.log('Time overlap detected with existing job');
            return res.status(400).json({ error: 'The new job overlaps with an existing scheduled job.' });
          }
        }

        // If no overlap is found and technician is available
        console.log('Technician is available to accept the new job');
        return res.status(200).json({ message: 'Technician is available for the new job.' });
      });
    });
  });
}







module.exports = {
  createTechnician,
  getAllTechnicians,
  getTechnicianById,
  updateTechnician,
  deleteTechnician,
  getTechnicianByToken,
  updateFCMTokenTechnician,
  sendLocation,
  declineOrderForTechnician,
  changeTechnicianStatus,
  checkTechnicianAvailability
};
