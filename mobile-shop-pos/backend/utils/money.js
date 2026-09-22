const {Prisma}=require('../db');
function money(value) {
  const n=new Prisma.Decimal(value);
  if(!n.isFinite()||n.lt(0)||n.gt('99999999.99')||n.decimalPlaces()>2)throw new Error('Money must be non-negative, with at most two decimal places and below 100 million');
  return n;
}
module.exports={money};
