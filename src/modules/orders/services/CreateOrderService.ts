import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IOrdersRepository from '../repositories/IOrdersRepository';
import Order from '../infra/typeorm/entities/Order';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError(
        `The customer with id ${customer_id} does not exists.`,
      );
    }

    const productsIds = products.map(product => ({ id: product.id }));

    const existingProducts = await this.productsRepository.findAllById(
      productsIds,
    );

    const existingProductsIds = existingProducts.map(product => product.id);

    const findProductsWithInvalidIds = products.filter(
      product => !existingProductsIds.includes(product.id),
    );

    if (findProductsWithInvalidIds.length) {
      throw new AppError(
        `There is no product with the id ${findProductsWithInvalidIds[0].id}`,
      );
    }

    const findProductsWithInsufficientQuantities = products.filter(
      product =>
        existingProducts.filter(p => p.quantity < product.quantity).length,
    );

    if (findProductsWithInsufficientQuantities.length) {
      throw new AppError(
        `The product with id ${findProductsWithInsufficientQuantities[0].id} does not have ${findProductsWithInsufficientQuantities[0].quantity} unities.`,
      );
    }

    const serializedProducts = products.map(product => {
      return {
        product_id: product.id,
        quantity: product.quantity,
        price: existingProducts.filter(p => p.id === product.id)[0].price,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
