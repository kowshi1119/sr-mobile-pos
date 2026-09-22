// A single client is shared by every route and closed by the application lifecycle.
const client = process.env.DESKTOP_MODE === '1' ? require('./generated/desktop') : require('@prisma/client');
const prisma = new client.PrismaClient();
if(process.env.DESKTOP_MODE==='1') {
  const fields=new Set(['totalDebt','sellingPrice','costPrice','priceOverride','totalAmount','discountAmount','unitPrice','estimatedCost','actualCost','amount','unitCost','totalCost','targetAmount','bundlePrice']);
  function normalize(value) {
    if(!value||typeof value!=='object'||value instanceof Date||value instanceof client.Prisma.Decimal)return;
    if(Array.isArray(value)){value.forEach(normalize);return;}
    for(const [key,item] of Object.entries(value)) {
      if(fields.has(key)&&item!==null&&item!==undefined) {
        const convert=x=>{const n=new client.Prisma.Decimal(x);if(!n.isFinite()||n.lt(0)||n.gt('99999999.99'))throw new Error('Invalid monetary amount');return n.toDecimalPlaces(2);};
        if(typeof item==='object'&&!(item instanceof client.Prisma.Decimal)){for(const operation of ['set','increment','decrement'])if(item[operation]!==undefined)item[operation]=convert(item[operation]);}
        else value[key]=convert(item);
      } else normalize(item);
    }
  }
  prisma.$use(async(params,next)=>{for(const key of ['data','create','update'])normalize(params.args?.[key]);return next(params);});
}
module.exports = { prisma, Prisma: client.Prisma };
