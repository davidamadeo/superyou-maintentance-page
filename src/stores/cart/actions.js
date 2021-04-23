import {cartStore, derivedTotalSumAssured, paymentTermYearly, derivedTotalQuantity} from "./store";
import { cookieAddAndSubstractQuantity, cookieDeleteCartPlan, cookieAddToCart, cookieAddAndRemoveChoosenRider } from "../../utils/_cartcookie";
import { getPlanById } from "../../api/products.service";

let totalSumAssured;
derivedTotalSumAssured.subscribe(amount => {
  totalSumAssured = amount;
})

let totalQuantity;
derivedTotalQuantity.subscribe(count => {
  totalQuantity = count;
})

let cartData;

export function addToCart({planId, quantity, price, riders, validation_type, sum_assured}, insuredFor, insuredDob, planDetail, productSlug, actionType = "READ") {
  // argument planDetail is object
  // { planId: string, fetched: boolean, quantity: number, price: number, riders: object}
  let updatedCart;
  cartStore.update(($cartStore) => {
    const p_ids = Object.keys($cartStore.products);
    if($cartStore.insuredDob !== insuredDob && p_ids.length) {
      p_ids.forEach(id => {
        $cartStore.products[id].fetched = false;
      })
    }
    updatedCart = $cartStore;
    updatedCart.insuredFor = insuredFor;
    updatedCart.insuredDob = insuredDob;

    if (planId in updatedCart.products) {
      updatedCart.products[planId] = {
        planId: planId,
        quantity: updatedCart.products[planId].quantity + quantity,
        price: updatedCart.products[planId].price + price,
        riders,
        fetched: false,
        validation_type,
        product_slug: productSlug,
        sum_assured
      }
    } else {
      updatedCart.products[planId] = {
        planId,
        quantity,
        price,
        riders,
        fetched: false,
        validation_type,
        product_slug: productSlug,
        sum_assured
      }
    }

    return updatedCart;
  });

  if (actionType === "SAVE_TO_COOKIE") {
    setTimeout(() => {
      cookieAddToCart(planDetail, productSlug, insuredFor, insuredDob, riders);
    }, 100);
  }

}

export function addQuantityPlan(planId, sumAssuredPlan, price, validationType) {
  // add +1
    let updatedCart;
    cartStore.update(($cartStore) => {
      updatedCart = $cartStore;
      switch (validationType) {
        case "only_once":
          return updatedCart;
        case "sum_assured":
          updatedCart.products[planId].quantity += 1;
          updatedCart.products[planId].price = updatedCart.products[planId].quantity * price;
          return updatedCart;
        case "":
          updatedCart.products[planId].quantity += 1;
          updatedCart.products[planId].price = updatedCart.products[planId].quantity * price;
          return updatedCart;
        default:
          return updatedCart
      }
    })

    
  
  // save to localStorage
  setTimeout(() => {
    const { quantity, price } = updatedCart.products[planId];
    cookieAddAndSubstractQuantity(planId, quantity, price, totalSumAssured, totalQuantity);
  }, 100)
}

export function substractQuantityPlan(planId, sumAssuredPlan, price, validationType) {
  // substract -1
  let updatedCart
  cartStore.update(($cartStore) => {
    updatedCart = $cartStore;
    updatedCart.products[planId].quantity -= 1;
    updatedCart.products[planId].price = updatedCart.products[planId].quantity * price;
    return updatedCart;
  });

  setTimeout(() => {
    // save to cookie
    const { quantity, price } = updatedCart.products[planId];
    cookieAddAndSubstractQuantity(planId, quantity, price, totalSumAssured, totalQuantity);
  }, 100)
}

export function updateProductPrice(planId, price) {
  // function for calculate and update total price if user change the toggle of payment term yearly or monthly
  cartStore.update(($cartStore) => {
    let updatedCart = $cartStore;
    updatedCart.products[planId].price = updatedCart.products[planId].quantity * price;

    return updatedCart;
  })
}

export function addRemoveUpdateRider(actionType, planId, riderId, riderPrice, riderCode) {
  let updatedCart
  cartStore.update(($cartStore) => {
    updatedCart = $cartStore;
    switch(actionType) {
      case "ADD_RIDER":
        updatedCart.products[planId].riders[riderId] = {
          id: riderId,
          price: riderPrice,
          product_code: riderCode
        }
        return updatedCart;
      case "REMOVE_RIDER":
        delete updatedCart.products[planId].riders[riderId];
        return updatedCart;
      case "UPDATE_RIDER_PRICE":
        updatedCart.products[planId].riders[riderId].price = riderPrice;
        return updatedCart;
      default:
        return updatedCart;
    }
  })
  // save to localStorage
  setTimeout(() => {
    const riderCodesArr = [];
    if (Object.keys(updatedCart.products[planId].riders).length) {
      Object.keys(updatedCart.products[planId].riders).forEach(id => {
        riderCodesArr.push(updatedCart.products[planId].riders[id].product_code);
      })
    }

    cookieAddAndRemoveChoosenRider(
      planId,
      Object.keys(updatedCart.products[planId].riders),
      riderCodesArr.join("+"));
  }, 100)
}

export function deleteCartItem(planId, sumAssuredPlan) {
  console.log(planId, sumAssuredPlan);
  cartStore.update($cartStore => {
    let updatedCart = $cartStore;
    // const planQuantity = updatedCart.products[planId].quantity;
    delete updatedCart.products[planId];
    return updatedCart;
  })

  // save to cookie
  setTimeout(() => {
    cookieDeleteCartPlan(planId, totalSumAssured, totalQuantity)
  }, 100)
}

export function getCartLocalStorage(name) {
  let cartStorage = localStorage.getItem(name);
  if(cartStorage) {
    const {products, payment_term_yearly} = JSON.parse(cartStorage);

    // reset fetch to false for initial load always update product data to API
    const productsPlanIdArr = Object.keys(products);
    if(productsPlanIdArr.length) {
      productsPlanIdArr.forEach(planId => {
        products[planId].fetched = false;
      })
    }
    cartStore.set({products});
    paymentTermYearly.set(payment_term_yearly);
  } 
}

export function setToLocalStorage() {
  if(process.browser) {
    window.localStorage.setItem(
      "cart",
      JSON.stringify(cartData)
    );
  }
}

export async function fetchProductsCart(productApiUrl, refetch = false) {
    // let totalSumAssured = 0;
    let cartData;
    let itemsDetail = {};

    cartStore.subscribe(cart => {
      cartData = cart;
    })
    const productsNotYetFetched = Object.keys(cartData.products).filter(
      (planId) => cartData.products[planId].fetched === false
    );

    // stop if all products already fetech
    if (!productsNotYetFetched.length) return {};

    const productsDetails = await Promise.all(
      productsNotYetFetched.map((planId) =>
        getPlanById(productApiUrl, planId, `${cartData.insuredDob}`)
      )
    );
    productsDetails.forEach(function (response, index) {
      itemsDetail[response.id] = response;

      cartStore.update((cart) => {
        if (refetch) {
          cart.products[response.id].fetched = false;  
        } else {
          cart.products[response.id].fetched = true;
        }
        cart.products[response.id].validation_type = response.validation_type;
        cart.products[response.id].product_slug = response.product_slug;
        cart.products[response.id].price =
          cart.products[response.id].quantity * response.monthly_premium;

        if (response.validation_type === "sum_assured") {
          totalSumAssured +=
            response.sum_assured * cart.products[response.id].quantity;
            cart.products[response.id].sum_assured = response.sum_assured;
        } else {
          cart.products[response.id].sum_assured = 0;
        }

        // Update riders price if any plan with choosen riders
        Object.keys(cart.products[response.id].riders).forEach((riderId) => {
          const rider = response.riders.find((rider) => rider.id === riderId);
          cart.products[response.id].riders[rider.id] = {
            id: rider.id,
            price: rider.monthly_premium,
            product_code: rider.product_code
          };
        });
        return cart;
      });
    });

    // sumAssuredTotal.update(() => {
      
    // });
    return itemsDetail
  }