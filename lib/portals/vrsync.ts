/**
 * XML no formato VRSync (Grupo OLX: ZAP Imóveis, Viva Real e OLX).
 *
 * Estrutura: ListingDataFeed > Header + Listings > Listing (ListingID,
 * Title, TransactionType, PublicationType, DetailViewUrl, Media, Details,
 * Location, ContactInfo). Só entram imóveis que passaram por portalIssues().
 */
import { tag, optionalTag, wrap, cdata, xmlNumber, xmlInt, XML_DECLARATION } from "./xml";
import { splitAddress, type FeedContext, type FeedProperty } from "./feed-types";

function listing(property: FeedProperty, context: FeedContext): string {
  const isRent = property.purpose === "locacao";
  const usage = property.portalType.startsWith("Commercial") ? "Commercial" : "Residential";
  const address = splitAddress(property.address);

  const media = property.photos.map((photo, index) =>
    tag("Item", photo.url, { medium: "image", caption: photo.caption || undefined, primary: index === 0 ? "true" : undefined })
  );

  const details = [
    tag("UsageType", usage),
    tag("PropertyType", property.portalType),
    `<Description>${cdata(property.description)}</Description>`,
    isRent
      ? tag("RentalPrice", xmlNumber(property.price), { currency: "BRL", period: "Monthly" })
      : tag("ListPrice", xmlNumber(property.price), { currency: "BRL" }),
    optionalTag("PropertyAdministrationFee", xmlNumber(property.condo_fee), { currency: "BRL" }),
    optionalTag("YearlyTax", xmlNumber(property.iptu), { currency: "BRL" }),
    optionalTag("LivingArea", xmlNumber(property.area_built ?? property.area_total), { unit: "square metres" }),
    optionalTag("LotArea", xmlNumber(property.area_total), { unit: "square metres" }),
    optionalTag("Bedrooms", xmlInt(property.bedrooms)),
    optionalTag("Bathrooms", xmlInt(property.bathrooms)),
    optionalTag("Suites", xmlInt(property.suites)),
    optionalTag("Garage", xmlInt(property.parking_spaces), { type: "Parking Space" }),
    property.is_furnished ? wrap("Features", [tag("Feature", "Furnished")]) : "",
  ];

  const location = [
    tag("Country", "Brasil", { abbreviation: "BR" }),
    tag("State", context.stateName, { abbreviation: context.state }),
    tag("City", property.city),
    tag("Neighborhood", property.neighborhood),
    optionalTag("Address", address.street),
    optionalTag("StreetNumber", address.number),
    optionalTag("PostalCode", (property.zip_code ?? "").replace(/\D/g, "")),
    optionalTag("Latitude", property.latitude ?? ""),
    optionalTag("Longitude", property.longitude ?? ""),
  ];

  const contact = [
    tag("Name", context.companyName),
    optionalTag("Email", context.email),
    optionalTag("Website", context.website),
    optionalTag("Telephone", context.phone),
  ];

  return wrap("Listing", [
    tag("ListingID", property.code),
    tag("Title", property.title),
    tag("TransactionType", isRent ? "For Rent" : "For Sale"),
    tag("PublicationType", property.highlight ? "PREMIUM" : "STANDARD"),
    tag("DetailViewUrl", property.url),
    wrap("Media", media),
    wrap("Details", details),
    // "Neighborhood": o portal mostra só o bairro, não a rua e o número.
    wrap("Location", location, { displayAddress: "Neighborhood" }),
    wrap("ContactInfo", contact),
  ]);
}

export function buildVrsyncXml(properties: FeedProperty[], context: FeedContext): string {
  const header = wrap("Header", [
    tag("Provider", context.companyName),
    tag("Email", context.email),
    tag("ContactName", context.companyName),
    tag("PublishDate", context.generatedAt.toISOString().slice(0, 19)),
    optionalTag("Telephone", context.phone),
  ]);

  return (
    XML_DECLARATION +
    "\n" +
    wrap(
      "ListingDataFeed",
      [header, wrap("Listings", properties.map((property) => listing(property, context)))],
      {
        xmlns: "http://www.vivareal.com/schemas/1.0/VRSync",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:schemaLocation": "http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd",
      }
    ) +
    "\n"
  );
}
