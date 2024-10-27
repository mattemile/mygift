import { isVercelCommerceError } from "../type-guards";
import { notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";


import {
  bigCommerceToVercelCart,
  bigCommerceToVercelCollection,
  bigCommerceToVercelPageContent,
  bigCommerceToVercelProduct,
  bigCommerceToVercelProducts,
  vercelFromBigCommerceLineItems,
  vercelToBigCommerceSorting,
} from "../bigcommerce/mappers";
import { memoizedCartRedirectUrl } from "./storefront-config";
import {
  BigCommerceAddToCartOperation,
  BigCommerceCarousel,
  BigCommerceCart,
  BigCommerceCartOperation,
  BigCommerceCategoryTreeItem,
  BigCommerceCheckoutOperation,
  BigCommerceCollectionOperation,
  BigCommerceCollectionsOperation,
  BigCommerceCreateCartOperation,
  BigCommerceDeleteCartItemOperation,
  BigCommerceEntityIdOperation,
  BigCommerceFeaturedProductsOperation,
  BigCommerceMain,
  BigCommerceMenuOperation,
  BigCommerceNewestProductsOperation,
  BigCommercePage,
  BigCommercePageOperation,
  BigCommercePagesOperation,
  BigCommerceProduct,
  BigCommerceProductOperation,
  BigCommerceProductsCollectionOperation,
  BigCommerceProductsOperation,
  BigCommerceRecommendationsOperation,
  BigCommerceSearchProductsOperation,
  BigCommerceUpdateCartItemOperation,
  Connection,
  Edge,
  SupabaseProduct,
  VercelCart,
  VercelCollection,
  VercelMenu,
  VercelPage,
  VercelProduct,
} from "../types";
import { createClient } from "@/utils/supabase/server";

type ExtractVariables<T> = T extends { variables: object }
  ? T["variables"]
  : never;

const getEntityIdByHandle = async (entityHandle: string) => {
  const res = await bigCommerceFetch<BigCommerceEntityIdOperation>({
    query: "",
    variables: {
      path: `/${entityHandle}`,
    },
  });

  return res.body.data.site.route.node?.entityId;
};

export async function bigCommerceFetch<T>({
  query,
  variables,
  headers,
  cache = "force-cache",
}: {
  query: string;
  variables?: ExtractVariables<T>;
  headers?: HeadersInit;
  cache?: RequestCache;
}): Promise<{ status: number; body: T } | never> {
  try {
    const result = await fetch('', {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${('')}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        ...(query && { query }),
        ...(variables && { variables }),
      }),
      cache,
    });

    const body = await result.json();

    if (body.errors) {
      throw body.errors[0];
    }

    return {
      status: result.status,
      body,
    };
  } catch (e) {
    if (isVercelCommerceError(e)) {
      throw {
        status: e.status || 500,
        message: e.message,
        query,
      };
    }

    throw {
      error: e,
      query,
    };
  }
}

const getCategoryEntityIdbyHandle = async (handle: string) => {
  const resp = await bigCommerceFetch<BigCommerceMenuOperation>({
    query: "",
  });
  const recursiveFindCollectionId = (
    list: BigCommerceCategoryTreeItem[],
    slug: string
  ): number => {
    const collectionId = list
      .flatMap((item): number | null => {
        if (item.path.includes(slug!)) {
          return item.entityId;
        }

        if (item.children && item.children.length) {
          return recursiveFindCollectionId(item.children!, slug);
        }

        return null;
      })
      .filter((id) => typeof id === "number")[0];

    return collectionId!;
  };

  return recursiveFindCollectionId(resp.body.data.site.categoryTree, handle);
};

const getBigCommerceProductsWithCheckout = async (
  cartId: string,
  lines: { merchandiseId: string; quantity: number; productId?: string }[]
) => {
  const productIds = lines.map(({ merchandiseId, productId }) =>
    parseInt(productId ?? merchandiseId, 10)
  );
  const bigCommerceProductListRes =
    await bigCommerceFetch<BigCommerceProductsOperation>({
      query: "",
      variables: {
        entityIds: productIds,
      },
      cache: "no-store",
    });
  const bigCommerceProductList =
    bigCommerceProductListRes.body.data.site.products.edges.map(
      (product) => product.node
    );

  const createProductList = (
    idList: number[],
    products: BigCommerceProduct[]
  ) => {
    return idList.map((productId) => {
      const productData = products.find(
        ({ entityId }) => entityId === productId
      )!;

      return {
        productId,
        productData,
      };
    });
  };
  const bigCommerceProducts = createProductList(
    productIds,
    bigCommerceProductList
  );

  const resCheckout = await bigCommerceFetch<BigCommerceCheckoutOperation>({
    query: "",
    variables: {
      entityId: cartId,
    },
    cache: "no-store",
  });
  const checkout = resCheckout.body.data.site.checkout ?? {
    subtotal: {
      value: 0,
      currencyCode: "",
    },
    grandTotal: {
      value: 0,
      currencyCode: "",
    },
    taxTotal: {
      value: 0,
      currencyCode: "",
    },
  };

  const checkoutUrlRes = await memoizedCartRedirectUrl(cartId);
  const checkoutUrl = checkoutUrlRes.data?.embedded_checkout_url;

  return {
    productsByIdList: bigCommerceProducts,
    checkoutUrl,
    checkout,
  };
};

export async function createCart(): Promise<VercelCart> {
  // NOTE: on BigCommerce side we can't create cart
  // w/t item params as quantity, productEntityId
  return {
    id: "",
    checkoutUrl: "",
    cost: {
      subtotalAmount: {
        amount: "",
        currencyCode: "",
      },
      totalAmount: {
        amount: "",
        currencyCode: "",
      },
      totalTaxAmount: {
        amount: "",
        currencyCode: "",
      },
    },
    lines: [],
    totalQuantity: 0,
  };
}
/*
export async function addToCart(
  cartId: string,
  lines: { merchandiseId: string; quantity: number; productId?: string }[]
): Promise<VercelCart> {
  let bigCommerceCart: BigCommerceCart;

  if (cartId) {
    const res = await bigCommerceFetch<BigCommerceAddToCartOperation>({
      query: addCartLineItemMutation,
      variables: {
        addCartLineItemsInput: {
          cartEntityId: cartId,
          data: {
            lineItems: lines.map(({ merchandiseId, quantity, productId }) => ({
              productEntityId: parseInt(productId!, 10),
              variantEntityId: parseInt(merchandiseId, 10),
              quantity
            }))
          }
        }
      },
      cache: 'no-store'
    });

    bigCommerceCart = res.body.data.cart.addCartLineItems.cart;
  } else {
    const res = await bigCommerceFetch<BigCommerceCreateCartOperation>({
      query: createCartMutation,
      variables: {
        createCartInput: {
          lineItems: lines.map(({ merchandiseId, quantity, productId }) => ({
            productEntityId: parseInt(productId!, 10),
            variantEntityId: parseInt(merchandiseId, 10),
            quantity
          }))
        }
      },
      cache: 'no-store'
    });

    bigCommerceCart = res.body.data.cart.createCart.cart;
  }

  const { productsByIdList, checkout, checkoutUrl } = await getBigCommerceProductsWithCheckout(
    bigCommerceCart.entityId,
    lines
  );

  return bigCommerceToVercelCart(bigCommerceCart, productsByIdList, checkout, checkoutUrl);
}

export async function removeFromCart(cartId: string, lineIds: string[]): Promise<VercelCart | undefined> {
  let cartState: { status: number; body: BigCommerceDeleteCartItemOperation };
  const removeCartItem = async (itemId: string) => {
    const res = await bigCommerceFetch<BigCommerceDeleteCartItemOperation>({
      query: deleteCartLineItemMutation,
      variables: {
        deleteCartLineItemInput: {
          cartEntityId: cartId,
          lineItemEntityId: itemId
        }
      },
      cache: 'no-store'
    });

    return res;
  };

  if (lineIds.length === 1) {
    cartState = await removeCartItem(lineIds[0]!);
  } else if (lineIds.length > 1) {
    // NOTE: can it happen at all??
    let operations = lineIds.length;

    while (operations > 0) {
      operations--;
      cartState = await removeCartItem(lineIds[operations]!);
    }
  }

  const cart = cartState!.body.data.cart.deleteCartLineItem.cart;

  if (cart === null)  {
    return undefined;
  }

  const lines = vercelFromBigCommerceLineItems(cart.lineItems);
  const { productsByIdList, checkout, checkoutUrl } = await getBigCommerceProductsWithCheckout(
    cartId,
    lines
  );

  return bigCommerceToVercelCart(cart, productsByIdList, checkout, checkoutUrl);
}

// NOTE: update happens on product & variant levels w/t optionEntityId
export async function updateCart(
  cartId: string,
  lines: { id: string; merchandiseId: string; quantity: number; productSlug?: string }[]
): Promise<VercelCart> {
  let cartState: { status: number; body: BigCommerceUpdateCartItemOperation } | undefined;

  for (let updates = lines.length; updates > 0; updates--) {
    const { id, merchandiseId, quantity, productSlug } = lines[updates - 1]!;
    const productEntityId = (await getProductIdBySlug(productSlug!))?.entityId!;

    const res = await bigCommerceFetch<BigCommerceUpdateCartItemOperation>({
      query: updateCartLineItemMutation,
      variables: {
        updateCartLineItemInput: {
          cartEntityId: cartId,
          lineItemEntityId: id,
          data: {
            lineItem: {
              variantEntityId: parseInt(merchandiseId, 10),
              productEntityId,
              quantity
            }
          }
        }
      },
      cache: 'no-store'
    });

    cartState = res;
  }

  const updatedCart = cartState!.body.data.cart.updateCartLineItem.cart;
  const { productsByIdList, checkout, checkoutUrl } = await getBigCommerceProductsWithCheckout(
    cartId,
    lines
  );

  return bigCommerceToVercelCart(updatedCart, productsByIdList, checkout, checkoutUrl);
}

export async function getCart(cartId: string): Promise<VercelCart | undefined> {
  const res = await bigCommerceFetch<BigCommerceCartOperation>({
    query: '',
    variables: { entityId: cartId },
    cache: 'no-store'
  });

  if (!res.body.data.site.cart) {
    return undefined;
  }

  const cart = res.body.data.site.cart;
  const lines = vercelFromBigCommerceLineItems(cart.lineItems);
  const { productsByIdList, checkout, checkoutUrl } = await getBigCommerceProductsWithCheckout(
    cartId,
    lines
  );

  return bigCommerceToVercelCart(cart, productsByIdList, checkout, checkoutUrl);
}
*/
export async function getCollection(handle: string): Promise<VercelCollection> {
  const entityId = await getCategoryEntityIdbyHandle(handle);
  const res = await bigCommerceFetch<BigCommerceCollectionOperation>({
    query: "",
    variables: {
      entityId,
    },
  });

  return bigCommerceToVercelCollection(res.body.data.site.category);
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey,
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<VercelProduct[]> {
  const expectedCollectionBreakpoints: Record<string, string> = {
    "hidden-homepage-carousel": "carousel_collection",
    "hidden-homepage-featured-items": "featured_collection",
  };

  const supabase = createClient();

  if (expectedCollectionBreakpoints[collection] === "carousel_collection") {
    const todos = await supabase
      .from("gift")
      .select("*")
      .eq("is_active", true)
      .returns<SupabaseProduct[]>()
      .order("id");

    let _listGift: SupabaseProduct[] = [];
    _listGift = todos.data!;

    let prod!: BigCommerceProduct;
    let prod2!: BigCommerceProduct;
    let prod3!: BigCommerceProduct;

    let nodesA: Edge<BigCommerceProduct>[] = [];
    let singleNode: Edge<BigCommerceProduct>;

    _listGift.forEach((element, i) => {
      prod = {
        id: i,
        entityId: i,
        sku: i.toString(),
        upc: i.toString(),
        name: element.name,
        brand: {
          name: element.name,
        },
        plainTextDescription: element.description,
        description: element.description,
        availabilityV2: {
          status: "1",
          description: "Nuovo",
        },
        defaultImage: {
          url: element.defaultimage,
          altText: "alttext",
        },
        images: {
          edges: [
            {
              node: {
                url: element.image1,
                altText: "alttext",
              },
            },
            {
              node: {
                url: element.image2,
                altText: "alttext",
              },
            },
            {
              node: {
                url: element.image3,
                altText: "alttext",
              },
            },
          ],
        },
        seo: {
          pageTitle: "",
          metaDescription: "",
          metaKeywords: "",
        },
        path: "product/" + element.pathname,
        prices: {
          price: {
            value: element.price,
            currencyCode: "EUR",
          },
          priceRange: {
            min: {
              value: element.price,
              currencyCode: "EUR",
            },
            max: {
              value: element.price,
              currencyCode: "EUR",
            },
          },
        },
        createdAt: {
          utc: new Date(),
        },
        variants: {
          edges: [],
        },
        productOptions: {
          edges: [],
        },
      };
      singleNode = {
        node: prod,
      };
      nodesA.push(singleNode);
    });

    // const prodAA: BigCommerceProduct = {
    //   id: 1,
    //   entityId: 1,
    //   sku: "a",
    //   upc: "b",
    //   name: "name",
    //   brand: {
    //     name: "Brand",
    //   },
    //   plainTextDescription: "plainTextDescription",
    //   description: "description",
    //   availabilityV2: {
    //     status: "statusv2",
    //     description: "descriptionv2",
    //   },
    //   defaultImage: {
    //     url: "https://s3.amazonaws.com/images.ilcapitanoshop.com/A24---brooks---1104301D020.JPG",
    //     altText: "alttext",
    //   },
    //   images: {
    //     edges: [
    //       {
    //         node: {
    //           url: "https://s3.amazonaws.com/images.ilcapitanoshop.com/A24---brooks---1104301D020.JPG",
    //           altText: "alttext",
    //         },
    //       },
    //     ],
    //   },
    //   seo: {
    //     pageTitle: "",
    //     metaDescription: "",
    //     metaKeywords: "",
    //   },
    //   path: "product/name",
    //   prices: {
    //     price: {
    //       value: 4,
    //       currencyCode: "EUR",
    //     },
    //     priceRange: {
    //       min: {
    //         value: 4,
    //         currencyCode: "EUR",
    //       },
    //       max: {
    //         value: 4,
    //         currencyCode: "EUR",
    //       },
    //     },
    //   },
    //   createdAt: {
    //     utc: new Date(),
    //   },
    //   variants: {
    //     edges: [],
    //   },
    //   productOptions: {
    //     edges: [],
    //   },
    // };

    const conn: Connection<BigCommerceProduct> = {
      edges: nodesA,
    };
    const option: BigCommerceNewestProductsOperation = {
      data: {
        site: {
          newestProducts: conn,
        },
      },
      variables: {
        first: 10,
      },
    };

    const res: BigCommerceCarousel = {
      status: "",
      body: option,
    };

    /*  const res = await bigCommerceFetch<BigCommerceNewestProductsOperation>({
      query: "",
      variables: {
        first: 10,
      },
    });*/

    if (!res.body.data.site.newestProducts) {
      console.log(`No collection found for \`${collection}\``);
      return [];
    }
    const productList = res.body.data.site.newestProducts.edges.map(
      (item) => item.node
    );

    return bigCommerceToVercelProducts(productList);
  }

  if (expectedCollectionBreakpoints[collection] === "featured_collection") {
    const todos = await supabase
    .from("gift")
    .select("*")
    .eq("is_active", true)
    .returns<SupabaseProduct[]>()
    .order("id");

  let _listGift: SupabaseProduct[] = [];
  _listGift = todos.data!;

  let prod!: BigCommerceProduct;
  let prod2!: BigCommerceProduct;
  let prod3!: BigCommerceProduct;

  let nodesA: Edge<BigCommerceProduct>[] = [];
  let singleNode: Edge<BigCommerceProduct>;

  _listGift.forEach((element, i) => {
    prod = {
      id: i,
      entityId: i,
      sku: i.toString(),
      upc: i.toString(),
      name: element.name,
      brand: {
        name: element.name,
      },
      plainTextDescription: element.description,
      description: element.description,
      availabilityV2: {
        status: "1",
        description: "Nuovo",
      },
      defaultImage: {
        url: element.defaultimage,
        altText: "alttext",
      },
      images: {
        edges: [
          {
            node: {
              url: element.image1,
              altText: "alttext",
            },
          },
          {
            node: {
              url: element.image2,
              altText: "alttext",
            },
          },
          {
            node: {
              url: element.image3,
              altText: "alttext",
            },
          },
        ],
      },
      seo: {
        pageTitle: "",
        metaDescription: "",
        metaKeywords: "",
      },
      path: "product/" + element.pathname,
      prices: {
        price: {
          value: element.price,
          currencyCode: "EUR",
        },
        priceRange: {
          min: {
            value: element.price,
            currencyCode: "EUR",
          },
          max: {
            value: element.price,
            currencyCode: "EUR",
          },
        },
      },
      createdAt: {
        utc: new Date(),
      },
      variants: {
        edges: [],
      },
      productOptions: {
        edges: [],
      },
    };
    singleNode = {
      node: prod,
    };
    nodesA.push(singleNode);
  });


    const conn: Connection<BigCommerceProduct> = {
      edges:nodesA
    };

    const option: BigCommerceFeaturedProductsOperation = {
      data: {
        site: {
          featuredProducts: conn,
        },
      },
      variables: {
        first: 1,
      },
    };

    const res: BigCommerceMain = {
      status: "",
      body: option,
    };

    /* const res = await bigCommerceFetch<BigCommerceFeaturedProductsOperation>({
      query: "",
      variables: {
        first: 10,
      },
    });*/

    if (!res.body.data.site.featuredProducts) {
      console.log(`No collection found for \`${collection}\``);
      return [];
    }
    const productList = res.body.data.site.featuredProducts.edges.map(
      (item) => item.node
    );

    return bigCommerceToVercelProducts(productList);
  }

  const entityId = await getCategoryEntityIdbyHandle(collection);
  const sortBy = vercelToBigCommerceSorting(reverse ?? false, sortKey);
  const res = await bigCommerceFetch<BigCommerceProductsCollectionOperation>({
    query: "",
    variables: {
      entityId,
      first: 10,
      hideOutOfStock: false,
      sortBy: sortBy,
    },
  });

  if (!res.body.data.site.category) {
    console.log(`No collection found for \`${collection}\``);
    return [];
  }
  const productList = res.body.data.site.category.products.edges.map(
    (item) => item.node
  );

  return bigCommerceToVercelProducts(productList);
}

export async function getCollections(): Promise<VercelCollection[]> {
  const res = await bigCommerceFetch<BigCommerceCollectionsOperation>({
    query: "",
  });
  const collectionIdList = res.body.data.site.categoryTree.map(
    ({ entityId }) => entityId
  );
  const collections = await Promise.all(
    collectionIdList.map(async (entityId) => {
      const res = await bigCommerceFetch<BigCommerceCollectionOperation>({
        query: "",
        variables: {
          entityId,
        },
      });
      return bigCommerceToVercelCollection(res.body.data.site.category);
    })
  );

  return collections;
}

export async function getMenu(handle: string): Promise<VercelMenu[]> {
  const configureMenuPath = (path: string) =>
    path
      .split("/")
      .filter((item) => item.length)
      .pop();
  const createVercelCollectionPath = (
    title: string,
    menuType: "footer" | "header"
  ) => (menuType === "header" ? `/search/${title}` : `/${title}`);
  const configureVercelMenu = (
    menuData: BigCommerceCategoryTreeItem[] | BigCommercePage[],
    isMenuData: boolean,
    menuType?: "footer" | "header"
  ): VercelMenu[] => {
    if (isMenuData) {
      return menuData
        .flatMap((item) => {
          let vercelMenuItem;

          if (menuType === "header") {
            const { name, path, hasChildren, children } =
              item as BigCommerceCategoryTreeItem;
            const vercelTitle = configureMenuPath(path ?? "");
            // NOTE: keep only high level categories for NavBar
            // if (hasChildren && children) {
            //   return configureVercelMenu(children, hasChildren);
            // }

            vercelMenuItem = {
              title: name,
              path: createVercelCollectionPath(
                vercelTitle!,
                menuType ?? "header"
              ),
            };

            return [vercelMenuItem];
          }

          if (menuType === "footer") {
            const { isVisibleInNavigation, name, path } =
              item as BigCommercePage;
            const vercelTitle = configureMenuPath(path ?? "");

            vercelMenuItem = {
              title: name,
              path: createVercelCollectionPath(
                vercelTitle!,
                menuType ?? "footer"
              ),
            };
            // NOTE: blog has different structure & separate mapper
            return vercelMenuItem.title === "Blog" || !isVisibleInNavigation
              ? []
              : [vercelMenuItem];
          }

          return [];
        })
        .slice(0, 4);
    }

    return [];
  };

  if (handle === "next-js-frontend-footer-menu") {
    const res = await bigCommerceFetch<BigCommercePagesOperation>({
      query: "",
    });
    const webPages = res.body.data.site.content.pages.edges.map(
      (item) => item.node
    );

    return configureVercelMenu(webPages, true, "footer");
  }

  if (handle === "next-js-frontend-header-menu") {
    const res = await bigCommerceFetch<BigCommerceMenuOperation>({
      query: "",
    });

    return configureVercelMenu(res.body.data.site.categoryTree, true, "header");
  }

  return [];
}

export async function getPage(handle: string): Promise<VercelPage> {
  const entityId = await getEntityIdByHandle(handle);

  if (!entityId) {
    notFound();
  }

  const res = await bigCommerceFetch<BigCommercePageOperation>({
    query: "",
    variables: {
      entityId,
    },
  });

  return bigCommerceToVercelPageContent(res.body.data.site.content.page);
}

export async function getPages(): Promise<VercelPage[]> {
  const res = await bigCommerceFetch<BigCommercePagesOperation>({
    query: "",
  });

  const pagesList = res.body.data.site.content.pages.edges.map(
    (item) => item.node
  );

  return pagesList.map((page) => bigCommerceToVercelPageContent(page));
}

export async function getProduct(
  handle: string
): Promise<VercelProduct | undefined> {

  const supabase = createClient();



  const todos = await supabase
  .from("gift")
  .select("*")
  .eq("pathname", handle)
  .returns<SupabaseProduct[]>()
  .order("id");

let _listGift: SupabaseProduct[] = [];
_listGift = todos.data!;

let prod!: BigCommerceProduct;

let nodesA: Edge<BigCommerceProduct>[] = [];
let singleNode: Edge<BigCommerceProduct>;
console.log("_listGift")
console.log(_listGift[0])
  prod = {
    id: 1,
    entityId: 1,
    sku: _listGift[0].id,
    upc: _listGift[0].id,
    name: _listGift[0].name,
    brand: {
      name: _listGift[0].name,
    },
    plainTextDescription: _listGift[0].description,
    description: _listGift[0].description,
    availabilityV2: {
      status: "1",
      description: "Nuovo",
    },
    defaultImage: {
      url: _listGift[0].defaultimage,
      altText: "alttext",
    },
    images: {
      edges: [
        {
          node: {
            url: _listGift[0].image1,
            altText: "alttext",
          },
        },
        {
          node: {
            url: _listGift[0].image2,
            altText: "alttext",
          },
        },
        {
          node: {
            url: _listGift[0].image3,
            altText: "alttext",
          },
        },
      ],
    },
    seo: {
      pageTitle: "",
      metaDescription: "",
      metaKeywords: "",
    },
    path: "product/" + _listGift[0].pathname,
    prices: {
      price: {
        value: _listGift[0].price,
        currencyCode: "EUR",
      },
      priceRange: {
        min: {
          value: 1,
          currencyCode: "EUR",
        },
        max: {
          value: 1,
          currencyCode: "EUR",
        },
      },
    },
    createdAt: {
      utc: new Date(),
    },
    variants: {
      edges: [],
    },
    productOptions: {
      edges: [],
    },
  };
  singleNode = {
    node: prod,
  };
  nodesA.push(singleNode);

  const conn: Connection<BigCommerceProduct> = {
    edges: nodesA
  };
  const option: BigCommerceProductOperation = {
    data: {
      site: {
        product: prod,
      },
    },
    variables: {
      productId: 10,
    },
  };

  const res = {
    status: 1,
    body: option,
  };

  // const res = await bigCommerceFetch<BigCommerceProductOperation>({
  //   query: "",
  //   variables: {
  //     productId: parseInt(handle, 10),
  //   },
  // });

  return bigCommerceToVercelProduct(res.body.data.site.product);
}

export async function getProductIdBySlug(path: string): Promise<
  | {
      __typename:
        | "Product"
        | "Category"
        | "Brand"
        | "NormalPage"
        | "ContactPage"
        | "RawHtmlPage"
        | "BlogIndexPage";
      entityId: number;
    }
  | undefined
> {
  const res = await bigCommerceFetch<BigCommerceEntityIdOperation>({
    query: "",
    variables: {
      path,
    },
  });

  return res.body.data.site.route.node;
}

export async function getProductRecommendations(
  productId: string
): Promise<VercelProduct[]> {
  const res = await bigCommerceFetch<BigCommerceRecommendationsOperation>({
    query: "",
    variables: {
      productId: productId,
    },
  });

  const productList = res.body.data.site.product.relatedProducts.edges.map(
    (item) => item.node
  );

  return bigCommerceToVercelProducts(productList);
}

export async function getProducts({
  query,
  reverse,
  sortKey,
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<VercelProduct[]> {
  const sort = vercelToBigCommerceSorting(reverse ?? false, sortKey);
  const res = await bigCommerceFetch<BigCommerceSearchProductsOperation>({
    query: "",
    variables: {
      filters: {
        searchTerm: query || "",
      },
      sort,
    },
  });

  const productList =
    res.body.data.site.search.searchProducts.products.edges.map(
      (item) => item.node
    );

  return bigCommerceToVercelProducts(productList);
}

// This is called from `app/api/revalidate.ts` so providers can control revalidation logic.
// eslint-disable-next-line no-unused-vars
export async function revalidate(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ status: 200, revalidated: true, now: Date.now() });
}
