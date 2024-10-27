interface StorefrontCheckoutResponse {
  data?: {
    cart_url: string;
    checkout_url: string;
    embedded_checkout_url: string;
  };
  status: number;
}

type CheckoutCache = {
  activeCartId: string | null;
  data: StorefrontCheckoutResponse | null;
}

const createCartRedirectUrl = () => {
  const localCache: CheckoutCache= {
    activeCartId: null,
    data: null,
  }

  return async (cartId: string): Promise<StorefrontCheckoutResponse> => {
    if (localCache.activeCartId !== cartId || !localCache.data) {
      const response = await fetch('', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-auth-token': '',
        },
      });
      const data = (await response.json()) as StorefrontCheckoutResponse;

      localCache.activeCartId = cartId;
      localCache.data = data;

      return data;
    }

    return localCache.data;
  };
}

export const memoizedCartRedirectUrl = createCartRedirectUrl();
