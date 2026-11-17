import  express  from "express";
import { getInvoicesCustomerDetails, getAllCustomers, addCustomer, updateCustomer, deleteCustomer, getAllCustomersDebts, getAllCustomersInfo, getPaymentsCustomerDetails} from "../controllers/CustomerController.js";

export const CustomerRoute = express.Router();


CustomerRoute.get('/customers' , getAllCustomers);

CustomerRoute.post('/customer/add' , addCustomer);

CustomerRoute.put('/customer/update' , updateCustomer);

CustomerRoute.get('/customers/debts', getAllCustomersDebts);

CustomerRoute.delete('/customer/delete' , deleteCustomer);

CustomerRoute.get('/customer/invoices' , getInvoicesCustomerDetails);

CustomerRoute.get('/customer/payment' , getPaymentsCustomerDetails);

CustomerRoute.get('/customer/info' , getAllCustomersInfo);