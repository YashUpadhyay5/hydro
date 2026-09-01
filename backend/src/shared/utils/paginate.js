/**
 * Production-Grade Database Pagination Helper for Sequelize Models
 */
const getPaginatedData = async (model, query = {}, defaultOptions = {}) => {
  const page = Math.max(1, parseInt(query.page || 1, 10));
  const limit = Math.min(200, Math.max(1, parseInt(query.limit || 20, 10)));
  const offset = (page - 1) * limit;

  const whereClause = { ...(defaultOptions.where || {}) };
  if (query.userId) whereClause.userId = query.userId;
  if (query.date) whereClause.date = query.date;

  const orderClause = defaultOptions.order || [['createdAt', 'DESC']];

  const { count, rows } = await model.findAndCountAll({
    where: whereClause,
    limit,
    offset,
    order: orderClause,
    ...(defaultOptions.attributes ? { attributes: defaultOptions.attributes } : {}),
    ...(defaultOptions.include ? { include: defaultOptions.include } : {})
  });

  const totalPages = Math.ceil(count / limit);
  const hasMore = page < totalPages;

  return {
    data: rows,
    page,
    limit,
    totalRecords: count,
    totalPages,
    hasMore
  };
};

module.exports = { getPaginatedData };
